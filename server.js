import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

const ai = new GoogleGenAI({ apiKey: "PASTE_YOUR_GEMINI_KEY_HERE" });
const RAPIDAPI_KEY = "PASTE_YOUR_RAPIDAPI_KEY_HERE";

async function extractTextFromPDF(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

app.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    let extractedText = '';
    if (file.mimetype === 'application/pdf') {
      extractedText = await extractTextFromPDF(file.buffer);
    } else {
      extractedText = file.buffer.toString('utf-8');
    }

    res.json({ success: true, text: extractedText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'File processing failed' });
  }
});

app.post('/analyze', async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;

    if (!resume || !jobDescription) {
      return res.status(400).json({ error: 'Resume and job description required' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `You are an expert ATS resume writer.

CANDIDATE'S RESUME:
${resume}

JOB DESCRIPTION:
${jobDescription}

YOUR TASK:
1. Identify the basic header info from the resume: name, designation, and ONLY the contact details that are actually present (phone, email, linkedin, github, portfolio website). If a contact field is not present in the original resume, leave it as an empty string "" — do NOT invent or guess any contact information.
2. Identify EVERY distinct section that exists in the candidate's original resume EXCEPT "Summary/Professional Summary" and "Skills/Technical Skills" — these two are NEVER included in the "sections" array because they are handled separately as top-level fields. Examples of sections that DO belong in "sections": Education, Experience, Projects, Certifications, Achievements, Academic Highlights, Extracurricular, Awards, Publications, etc.
3. Preserve the SAME remaining sections and SAME order as the original resume (excluding Summary and Skills). Do NOT add sections that don't exist in the original, and do NOT remove sections that do exist.
4. For each identified section, rewrite its content professionally, optimized for the job description, but keep the original meaning/facts intact (don't fabricate experience or education details — keep institution/company names, dates, scores exactly as given).
5. EDUCATION ORDER (if an Education section exists): Always list entries in REVERSE CHRONOLOGICAL order — highest/most recent degree FIRST (e.g., Bachelor's/College), then 12th/Senior Secondary, then 10th/High School LAST. Never list 10th or 12th before the highest degree.
6. SKILLS (top-level field, NOT in sections array) — ALWAYS generate this regardless of original resume content. Build it STRICTLY and ONLY from the job description's explicit requirements. Every category and every skill item must map directly to something mentioned in the job description. Do NOT include the candidate's original resume skills that are unrelated to this job description. The ONLY allowed additions beyond the explicit job description list are these universal skills, and only if genuinely relevant: Problem Solving, Communication, Teamwork, Git/Version Control. Nothing else outside the job description's explicit requirements should appear.
7. SUMMARY (top-level field, NOT in sections array) — Always write ONE 2-3 line professional summary tailored to the job description.
8. LENGTH CONSTRAINT: Keep all content concise. Limit each section's entries and bullet points so the entire resume fits on ONE page (roughly: max 4-5 bullet points per job/project, max 3-4 experience/project entries total, max 5-6 skill categories, max 3 highlights/certifications). Prioritize the most relevant and recent items if the original resume has more content than this.

Return ONLY valid JSON (no markdown, no backticks, no extra text) in this EXACT structure:

{
  "name": "Full Name",
  "designation": "Job Title matching the job description",
  "phone": "phone number or empty string if not present",
  "email": "email or empty string if not present",
  "linkedin": "linkedin url or empty string if not present",
  "github": "github url or empty string if not present",
  "portfolio": "portfolio website or empty string if not present",
  "summary": "2-3 line professional summary tailored to job description",
  "skills": [
    { "category": "Category Name", "items": "skills directly and ONLY from job description, organized by category" }
  ],
  "sections": [
    {
      "title": "Section name exactly as in original resume (e.g. Education, Experience, Certifications)",
      "type": "table",
      "entries": [
        { "left": "Institution/Company/Item name", "leftSub": "Degree/Role/Description", "right": "Duration", "rightSub": "Score/Location" }
      ]
    },
    {
      "title": "Section name (e.g. Experience, Projects)",
      "type": "list",
      "entries": [
        { "heading": "Job title or Project title", "subheading": "Company/Tech stack", "points": ["point 1", "point 2", "point 3"] }
      ]
    },
    {
      "title": "Section name (e.g. Certifications, Academic Highlights)",
      "type": "bullets",
      "entries": ["item 1", "item 2"]
    }
  ]
}

RULES FOR "sections" ARRAY:
- NEVER include "Summary", "Professional Summary", "Skills", or "Technical Skills" as a section here — these are strictly forbidden in this array, they live only in the top-level "summary" and "skills" fields.
- Use "type": "table" for sections like Education (institution/dates/scores in row format) — and for Education specifically, follow the reverse chronological order rule above (highest degree first, 10th last).
- Use "type": "list" for sections like Experience/Projects (heading + subheading + bullet points).
- Use "type": "bullets" for simple bullet-list sections (Certifications, Academic Highlights, Achievements).
- Preserve the exact order of remaining sections as they appear in the original resume.
- Keep total content concise enough to fit one page as per the length constraint above.

Return ONLY the JSON object, nothing else. Strictly apply the skills filter — only job-description-relevant skills allowed, no carryover of unrelated skills from the original resume. Strictly apply the contact info rule — never invent missing contact details. Strictly apply the education ordering rule — highest degree first, 10th/High School last.`,
    });

    let jsonText = response.text.trim();
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    const resumeData = JSON.parse(jsonText);

    res.json({ success: true, resumeData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Job Matcher Route
app.post('/jobs', async (req, res) => {
  try {
    const { designation } = req.body;

    if (!designation) {
      return res.status(400).json({ error: 'Designation required' });
    }

    const query = encodeURIComponent(`${designation} jobs in India`);

    const response = await fetch(`https://jsearch.p.rapidapi.com/search?query=${query}&page=1&num_pages=1&country=in`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com'
      }
    });

    const data = await response.json();

    const jobs = (data.data || []).slice(0, 6).map(job => ({
      title: job.job_title,
      company: job.employer_name,
      location: job.job_city ? `${job.job_city}, ${job.job_country}` : (job.job_country || 'Remote'),
      type: job.job_employment_type || 'Full-time',
      salary: job.job_min_salary && job.job_max_salary
        ? `${job.job_salary_currency || ''} ${job.job_min_salary} - ${job.job_max_salary}`
        : 'Not disclosed',
      applyUrl: job.job_apply_link || '#'
    }));

    res.json({ success: true, jobs });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Job fetch failed' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});