export interface EdmingleStudent {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  role?: string;
  enrolledCourses?: EdmingleEnrollment[];
  batchId?: string;
  courseId?: string;
}

export interface EdmingleEnrollment {
  courseId: string;
  courseName: string;
  batchId?: string;
  batchName?: string;
  enrollmentDate?: string;
  status?: "active" | "completed" | "inactive";
}

export interface EdmingleCourse {
  id: string;
  name: string;
  description?: string;
}

export interface EdmingleApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface EdmingleErrorResponse {
  success: false;
  error: string;
  message?: string;
  statusCode?: number;
}

export interface EdmingleVerifyStudentRequest {
  email: string;
  batchId?: string;
  courseId?: string;
}

export interface EdmingleVerifyStudentResponse {
  verified: boolean;
  studentData?: EdmingleStudent;
}
