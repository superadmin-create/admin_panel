import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 5,
  ssl: (process.env.DATABASE_URL || '').includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
});

async function queryWithRetry(text: string, params?: any[], retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error: any) {
      const isConnectionError = 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET' ||
        error.code === '57P01' ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('connection timeout') ||
        error.message?.includes('Connection refused');
      
      if (isConnectionError && attempt < retries) {
        console.warn(`[DB] Connection error (attempt ${attempt}/${retries}):`, error.message);
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw error;
    }
  }
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  status: string;
  teacher_email?: string;
}

export interface Topic {
  id: number;
  subject_name: string;
  name: string;
  status: string;
  teacher_email?: string;
}

export interface VivaResult {
  id: number;
  timestamp: Date;
  student_name: string;
  student_email: string;
  subject: string;
  topics: string;
  questions_answered: number;
  score: number;
  overall_feedback: string;
  transcript: string;
  recording_url: string | null;
  evaluation: Record<string, unknown> | null;
}

export interface VivaQuestion {
  id: number;
  subject: string;
  topics: string;
  question: string;
  expected_answer: string;
  difficulty: string;
  active: boolean;
}

export async function getSubjects(teacherEmail?: string): Promise<Subject[]> {
  let query = 'SELECT * FROM subjects WHERE status = $1';
  const params: string[] = ['active'];
  
  if (teacherEmail) {
    query += ' AND teacher_email = $2';
    params.push(teacherEmail);
  }
  
  query += ' ORDER BY name';
  const result = await queryWithRetry(query, params);
  return result.rows;
}

export async function createSubject(name: string, code: string = '', teacherEmail?: string): Promise<Subject> {
  const result = await queryWithRetry(
    'INSERT INTO subjects (name, code, status, teacher_email) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code, teacher_email = COALESCE(EXCLUDED.teacher_email, subjects.teacher_email) RETURNING *',
    [name, code, 'active', teacherEmail || null]
  );
  return result.rows[0];
}

export async function updateSubject(oldName: string, newName: string, code?: string): Promise<Subject | null> {
  const result = await queryWithRetry(
    'UPDATE subjects SET name = $1, code = COALESCE($2, code), updated_at = CURRENT_TIMESTAMP WHERE name = $3 RETURNING *',
    [newName, code, oldName]
  );
  if (result.rows.length > 0) {
    await queryWithRetry(
      'UPDATE topics SET subject_name = $1 WHERE subject_name = $2',
      [newName, oldName]
    );
  }
  return result.rows[0] || null;
}

export async function deleteSubject(name: string): Promise<boolean> {
  const result = await queryWithRetry(
    'DELETE FROM subjects WHERE name = $1',
    [name]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getTopics(subjectFilter?: string, teacherEmail?: string): Promise<Topic[]> {
  let query = 'SELECT * FROM topics WHERE status = $1';
  const params: string[] = ['active'];
  let paramIndex = 2;
  
  if (subjectFilter) {
    query += ` AND LOWER(subject_name) = LOWER($${paramIndex})`;
    params.push(subjectFilter);
    paramIndex++;
  }
  
  if (teacherEmail) {
    query += ` AND teacher_email = $${paramIndex}`;
    params.push(teacherEmail);
  }
  
  query += ' ORDER BY subject_name, name';
  const result = await queryWithRetry(query, params);
  return result.rows;
}

export async function createTopic(subjectName: string, name: string, teacherEmail?: string): Promise<Topic> {
  const result = await queryWithRetry(
    'INSERT INTO topics (subject_name, name, status, teacher_email) VALUES ($1, $2, $3, $4) ON CONFLICT (subject_name, name) DO NOTHING RETURNING *',
    [subjectName, name, 'active', teacherEmail || null]
  );
  return result.rows[0];
}

export async function updateTopic(
  oldSubject: string,
  oldName: string,
  newSubject: string,
  newName: string
): Promise<Topic | null> {
  const result = await queryWithRetry(
    'UPDATE topics SET subject_name = $1, name = $2, updated_at = CURRENT_TIMESTAMP WHERE LOWER(subject_name) = LOWER($3) AND LOWER(name) = LOWER($4) RETURNING *',
    [newSubject, newName, oldSubject, oldName]
  );
  return result.rows[0] || null;
}

export async function deleteTopic(subjectName: string, name: string): Promise<boolean> {
  const result = await queryWithRetry(
    'DELETE FROM topics WHERE LOWER(subject_name) = LOWER($1) AND LOWER(name) = LOWER($2)',
    [subjectName, name]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function saveVivaResult(result: Omit<VivaResult, 'id'>): Promise<VivaResult> {
  const queryResult = await queryWithRetry(
    `INSERT INTO viva_results 
     (timestamp, student_name, student_email, subject, topics, questions_answered, score, overall_feedback, transcript, recording_url, evaluation) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
     RETURNING *`,
    [
      result.timestamp,
      result.student_name,
      result.student_email,
      result.subject,
      result.topics,
      result.questions_answered,
      result.score,
      result.overall_feedback,
      result.transcript,
      result.recording_url,
      result.evaluation ? JSON.stringify(result.evaluation) : null
    ]
  );
  return queryResult.rows[0];
}

export async function getVivaResults(teacherEmail?: string): Promise<VivaResult[]> {
  let query = 'SELECT * FROM viva_results';
  const params: string[] = [];
  
  if (teacherEmail) {
    query += ` WHERE teacher_email = $1`;
    params.push(teacherEmail);
  }
  
  query += ' ORDER BY timestamp DESC';
  const result = await queryWithRetry(query, params);
  return result.rows;
}

export async function saveVivaQuestions(
  subject: string,
  topics: string,
  questions: Array<{ question: string; expectedAnswer: string; difficulty: string }>
): Promise<VivaQuestion[]> {
  const savedQuestions: VivaQuestion[] = [];
  
  for (const q of questions) {
    const result = await queryWithRetry(
      `INSERT INTO viva_questions (subject, topics, question, expected_answer, difficulty, active) 
       VALUES ($1, $2, $3, $4, $5, true) 
       RETURNING *`,
      [subject, topics, q.question, q.expectedAnswer, q.difficulty]
    );
    savedQuestions.push(result.rows[0]);
  }
  
  return savedQuestions;
}

export async function getVivaQuestions(subject?: string): Promise<VivaQuestion[]> {
  let query = 'SELECT * FROM viva_questions WHERE active = true';
  const params: string[] = [];
  
  if (subject) {
    query += ' AND LOWER(subject) = LOWER($1)';
    params.push(subject);
  }
  
  query += ' ORDER BY created_at DESC';
  const result = await queryWithRetry(query, params);
  return result.rows;
}

export interface TeacherDocument {
  id: number;
  teacher_email: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  subject: string | null;
  extracted_text: string;
  created_at: Date;
}

export async function saveTeacherDocument(
  teacherEmail: string,
  fileName: string,
  fileType: string,
  fileSize: number | null,
  subject: string | null,
  extractedText: string
): Promise<TeacherDocument> {
  const result = await queryWithRetry(
    `INSERT INTO teacher_documents (teacher_email, file_name, file_type, file_size, subject, extracted_text)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [teacherEmail, fileName, fileType, fileSize, subject, extractedText]
  );
  return result.rows[0];
}

export async function getTeacherDocuments(teacherEmail: string): Promise<TeacherDocument[]> {
  const result = await queryWithRetry(
    `SELECT id, teacher_email, file_name, file_type, file_size, subject, 
            LENGTH(extracted_text) as text_length, created_at
     FROM teacher_documents 
     WHERE teacher_email = $1 
     ORDER BY created_at DESC`,
    [teacherEmail]
  );
  return result.rows;
}

export async function getTeacherDocumentById(id: number, teacherEmail: string): Promise<TeacherDocument | null> {
  const result = await queryWithRetry(
    'SELECT * FROM teacher_documents WHERE id = $1 AND teacher_email = $2',
    [id, teacherEmail]
  );
  return result.rows[0] || null;
}

export async function deleteTeacherDocument(id: number, teacherEmail: string): Promise<boolean> {
  const result = await queryWithRetry(
    'DELETE FROM teacher_documents WHERE id = $1 AND teacher_email = $2',
    [id, teacherEmail]
  );
  return (result.rowCount ?? 0) > 0;
}

export { pool, queryWithRetry };
