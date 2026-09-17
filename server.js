const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------
// OFFICIAL MASTER ANSWER KEYS (SECURE ON SERVER ONLY)
// ---------------------------------------------------------
const MASTER_ANSWER_KEYS = {
  0: 1, 1: 2, 2: 2, 3: 1, 4: 1, 5: 1, 6: 0, 7: 1, 8: 0, 9: 2,
  10: 0, 11: 2, 12: 1, 13: 0, 14: 1, 15: 1, 16: 2, 17: 1, 18: 3, 19: 1,
  20: 1, 21: 2, 22: 2, 23: 1, 24: 1, 25: 1, 26: 1, 27: 2, 28: 0, 29: 3,
  30: 0, 31: 0, 32: 1, 33: 2, 34: 1, 35: 2, 36: 2, 37: 1, 38: 1, 39: 0
};

// IN-MEMORY STORAGE FOR EXAM SUBMISSIONS & LOGS
const SUBMISSIONS_DB = [];
const VIOLATIONS_DB = [];

const AUTH_DATABASE = {
  teachers: ["TEA-MAN-9982", "INV-JSS2-0010"],
  students: Array.from({ length: 100 }, (_, i) => `STU-2026-${String(i + 1).padStart(3, '0')}`)
};

// Root status check to keep Render active
app.get('/', (req, res) => {
  res.send('JSS2 Proctoring Server is Live and Running!');
});

// AUTHENTICATION ENDPOINT
app.post('/api/auth', (req, res) => {
  const { role, passcode, candidateName } = req.body;
  if (!candidateName || !passcode) {
    return res.status(400).json({ success: false, message: "Name and Passcode are required." });
  }

  if (role === 'student') {
    if (AUTH_DATABASE.students.includes(passcode.trim())) {
      return res.status(200).json({ success: true, candidateName, role: "student" });
    }
    return res.status(401).json({ success: false, message: "Invalid Student Passcode." });
  } 

  if (role === 'teacher') {
    if (AUTH_DATABASE.teachers.includes(passcode.trim())) {
      return res.status(200).json({ success: true, candidateName, role: "teacher" });
    }
    return res.status(401).json({ success: false, message: "Invalid Invigilator Passcode." });
  }

  return res.status(400).json({ success: false, message: "Invalid Role." });
});

// LOG SECURITY VIOLATIONS
app.post('/api/proctor/log-violation', (req, res) => {
  const { candidateName, violationType } = req.body;
  VIOLATIONS_DB.push({ candidateName, violationType, timestamp: new Date().toLocaleTimeString() });
  console.warn(`SECURITY ALERT: ${candidateName} - ${violationType}`);
  return res.status(200).json({ logged: true });
});

// SUBMIT & SCORE EXAM (SECURE SERVER COMPUTATION)
app.post('/api/exam/submit', (req, res) => {
  const { candidateName, answers, timeSpent } = req.body;
  
  let score = 0;
  const totalQuestions = Object.keys(MASTER_ANSWER_KEYS).length;

  Object.keys(MASTER_ANSWER_KEYS).forEach(qIdx => {
    if (answers[qIdx] !== undefined && parseInt(answers[qIdx]) === MASTER_ANSWER_KEYS[qIdx]) {
      score++;
    }
  });

  const percentage = ((score / totalQuestions) * 100).toFixed(1);
  const studentViolations = VIOLATIONS_DB.filter(v => v.candidateName === candidateName).length;

  const resultRecord = {
    candidateName,
    score,
    totalQuestions,
    percentage,
    timeSpent: timeSpent || "N/A",
    violations: studentViolations,
    submittedAt: new Date().toLocaleTimeString()
  };

  SUBMISSIONS_DB.push(resultRecord);
  return res.status(200).json({ success: true, score, totalQuestions, percentage });
});

// TEACHER LIVE RESULTS & RESULTS MONITORING ENDPOINT
app.get('/api/teacher/results', (req, res) => {
  return res.status(200).json({
    totalSubmissions: SUBMISSIONS_DB.length,
    submissions: SUBMISSIONS_DB,
    recentViolations: VIOLATIONS_DB
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
