import type {
  EdmingleStudent,
  EdmingleVerifyStudentResponse,
} from "@/lib/types/edmingle";

const EDMINGLE_BASE_URL =
  process.env.EDMINGLE_BASE_URL || "https://leapup-api.edmingle.com";
const EDMINGLE_API_KEY = process.env.EDMINGLE_API_KEY;
const EDMINGLE_INSTITUTION_ID = process.env.EDMINGLE_INSTITUTION_ID || "96317";
const EDMINGLE_ORG_ID = process.env.EDMINGLE_ORG_ID || "1081";

export async function verifyStudent(
  email: string,
  batchId?: string
): Promise<EdmingleVerifyStudentResponse> {
  if (!EDMINGLE_API_KEY || EDMINGLE_API_KEY === "your_edmingle_api_key_here") {
    console.error("EDMINGLE_API_KEY is not configured");
    throw new Error("LMS service is not configured");
  }

  if (!email) {
    throw new Error("Email is required");
  }

  try {
    const endpoint = process.env.EDMINGLE_VERIFY_ENDPOINT || "/nuSource/api/v1/student/search";
    
    const params = new URLSearchParams({
      institution_id: EDMINGLE_INSTITUTION_ID,
      student_email: email.toLowerCase().trim(),
    });

    const url = `${EDMINGLE_BASE_URL}${endpoint}?${params.toString()}`;

    const headers: HeadersInit = {
      "apikey": EDMINGLE_API_KEY,
      "Accept": "application/json",
    };

    if (EDMINGLE_ORG_ID) {
      headers["ORGID"] = EDMINGLE_ORG_ID;
    }

    console.log(`[Edmingle API] Calling: GET ${url}`);
    console.log(`[Edmingle API] Headers: apikey=***, ORGID=${EDMINGLE_ORG_ID}`);

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    const contentType = response.headers.get("content-type");
    
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(`[Edmingle API] Non-JSON response (${response.status}):`, text.substring(0, 500));
      
      if (text.includes("Account not found") || text.includes("DNS")) {
        throw new Error(`Edmingle account configuration error. Please verify your base URL and DNS settings.`);
      }
      
      if (response.status === 404) {
        return { verified: false };
      }
      
      throw new Error(`Invalid response from LMS API (Status: ${response.status}): ${text.substring(0, 100)}`);
    }

    const data = await response.json();

    console.log(`[Edmingle API] Response (${response.status}):`, JSON.stringify(data, null, 2));

    if (!response.ok || (data.code && data.code !== 200)) {
      const errorMessage = 
        data.message || 
        data.error || 
        `API returned status ${response.status}`;
      
      if (
        data.code === 10004 || 
        errorMessage.toLowerCase().includes("no such user") ||
        errorMessage.toLowerCase().includes("user not found") ||
        errorMessage.toLowerCase().includes("student not found") ||
        response.status === 404
      ) {
        console.log(`[Edmingle API] Student email "${email}" not found in LMS (code: ${data.code || response.status})`);
        return { verified: false };
      }
      
      console.error(`[Edmingle API] Error:`, errorMessage);
      throw new Error(errorMessage);
    }

    if (data.code === 200 && data.user_details && Array.isArray(data.user_details)) {
      const studentDetails = data.user_details.find(
        (user: any) => user.role === "student" && 
        user.student_email?.toLowerCase() === email.toLowerCase()
      ) || data.user_details[0];

      if (studentDetails && studentDetails.role === "student") {
        return {
          verified: true,
          studentData: {
            id: studentDetails.user_id || studentDetails.id || "",
            email: studentDetails.student_email || email,
            firstName: studentDetails.first_name || studentDetails.firstName || "",
            lastName: studentDetails.last_name || studentDetails.lastName || "",
            fullName: studentDetails.full_name || 
              studentDetails.fullName ||
              `${studentDetails.first_name || ""} ${studentDetails.last_name || ""}`.trim() ||
              studentDetails.student_email || email,
            phone: studentDetails.student_mobile_number || studentDetails.phone || "",
            role: studentDetails.role,
          },
        };
      }
    }

    return { verified: false };
  } catch (error) {
    console.error("[Edmingle API] Request failed:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: EDMINGLE_BASE_URL,
      hasApiKey: !!EDMINGLE_API_KEY,
    });

    if (error instanceof Error) {
      if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        throw new Error("Unable to connect to LMS service. Please check your network connection.");
      }

      if (error.message.includes("404") || error.message.includes("Not Found")) {
        return { verified: false };
      }

      throw error;
    }

    throw new Error("Failed to verify student with LMS");
  }
}
