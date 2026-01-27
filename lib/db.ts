import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface Subject {
  id: number;
  name: string;
  code: string;
  status: string;
}

export interface Topic {
  id: number;
  subject_id: number | null;
  subject_name: string;
  name: string;
  status: string;
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

export async function getSubjects(): Promise<Subject[]> {
  const result = await pool.query(
    'SELECT * FROM subjects WHERE status = $1 ORDER BY name',
    ['active']
  );
  return result.rows;
}

export async function createSubject(name: string, code: string = ''): Promise<Subject> {
  const result = await pool.query(
    'INSERT INTO subjects (name, code, status) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code RETURNING *',
    [name, code, 'active']
  );
  return result.rows[0];
}

export async function updateSubject(oldName: string, newName: string, code?: string): Promise<Subject | null> {
  const result = await pool.query(
    'UPDATE subjects SET name = $1, code = COALESCE($2, code), updated_at = CURRENT_TIMESTAMP WHERE name = $3 RETURNING *',
    [newName, code, oldName]
  );
  if (result.rows.length > 0) {
    await pool.query(
      'UPDATE topics SET subject_name = $1 WHERE subject_name = $2',
      [newName, oldName]
    );
  }
  return result.rows[0] || null;
}

export async function deleteSubject(name: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM subjects WHERE name = $1',
    [name]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getTopics(subjectFilter?: string): Promise<Topic[]> {
  let query = 'SELECT * FROM topics WHERE status = $1';
  const params: string[] = ['active'];
  
  if (subjectFilter) {
    query += ' AND LOWER(subject_name) = LOWER($2)';
    params.push(subjectFilter);
  }
  
  query += ' ORDER BY subject_name, name';
  const result = await pool.query(query, params);
  return result.rows;
}

export async function createTopic(subjectName: string, name: string): Promise<Topic> {
  const result = await pool.query(
    'INSERT INTO topics (subject_name, name, status) VALUES ($1, $2, $3) ON CONFLICT (subject_name, name) DO NOTHING RETURNING *',
    [subjectName, name, 'active']
  );
  return result.rows[0];
}

export async function updateTopic(
  oldSubject: string,
  oldName: string,
  newSubject: string,
  newName: string
): Promise<Topic | null> {
  const result = await pool.query(
    'UPDATE topics SET subject_name = $1, name = $2, updated_at = CURRENT_TIMESTAMP WHERE LOWER(subject_name) = LOWER($3) AND LOWER(name) = LOWER($4) RETURNING *',
    [newSubject, newName, oldSubject, oldName]
  );
  return result.rows[0] || null;
}

export async function deleteTopic(subjectName: string, name: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM topics WHERE LOWER(subject_name) = LOWER($1) AND LOWER(name) = LOWER($2)',
    [subjectName, name]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function saveVivaResult(result: Omit<VivaResult, 'id'>): Promise<VivaResult> {
  const queryResult = await pool.query(
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

export async function getVivaResults(): Promise<VivaResult[]> {
  const result = await pool.query(
    'SELECT * FROM viva_results ORDER BY timestamp DESC'
  );
  return result.rows;
}

export async function saveVivaQuestions(
  subject: string,
  topics: string,
  questions: Array<{ question: string; expectedAnswer: string; difficulty: string }>
): Promise<VivaQuestion[]> {
  const savedQuestions: VivaQuestion[] = [];
  
  for (const q of questions) {
    const result = await pool.query(
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
  const result = await pool.query(query, params);
  return result.rows;
}

export { pool };
