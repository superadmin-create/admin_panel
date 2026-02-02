import { NextRequest, NextResponse } from "next/server";

const EDMINGLE_API_KEY = process.env.EDMINGLE_API_KEY;
const EDMINGLE_ORG_ID = process.env.EDMINGLE_ORG_ID;
const EDMINGLE_INSTITUTION_ID = process.env.EDMINGLE_INSTITUTION_ID;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone } = body;

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, message: "Email or phone is required" },
        { status: 400 }
      );
    }

    if (!EDMINGLE_API_KEY || !EDMINGLE_ORG_ID) {
      console.error("Edmingle credentials not configured");
      return NextResponse.json(
        { success: false, message: "Verification service not configured" },
        { status: 500 }
      );
    }

    const baseUrl = `https://vyoma-api.edmingle.com/nuSource/api/v1`;
    
    const searchParams = new URLSearchParams({
      apikey: EDMINGLE_API_KEY,
      ORGID: EDMINGLE_ORG_ID,
    });

    if (email) {
      searchParams.append("email", email);
    }
    if (phone) {
      searchParams.append("phone", phone);
    }

    const verifyUrl = `${baseUrl}/student/search?${searchParams.toString()}`;
    
    console.log(`Verifying student with Edmingle: ${email || phone}`);
    
    const response = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`Edmingle API response: ${response.status} - ${errorText}`);
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.code === 10004 || errorData.message?.toLowerCase().includes("no such user")) {
          return NextResponse.json({
            success: true,
            verified: false,
            message: "Student not found. Please ensure you are registered with your institution."
          });
        }
      } catch {}
      
      if (response.status === 404 || response.status === 400) {
        return NextResponse.json({
          success: true,
          verified: false,
          message: "Student not found. Please ensure you are registered with your institution."
        });
      }
      
      return NextResponse.json(
        { success: false, message: "Verification service error" },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    if (data && (data.data || data.students || data.result)) {
      const students = data.data || data.students || data.result;
      const studentList = Array.isArray(students) ? students : [students];
      
      if (studentList.length > 0 && studentList[0]) {
        const student = studentList[0];
        return NextResponse.json({
          success: true,
          verified: true,
          student: {
            id: student.id || student.student_id,
            name: student.name || student.fullName || student.full_name,
            email: student.email,
            phone: student.phone || student.mobile,
          },
          message: "Student verified successfully"
        });
      }
    }

    return NextResponse.json({
      success: true,
      verified: false,
      message: "Student not found. Please ensure you are registered with your institution."
    });

  } catch (error) {
    console.error("Edmingle verification error:", error);
    return NextResponse.json(
      { success: false, message: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
