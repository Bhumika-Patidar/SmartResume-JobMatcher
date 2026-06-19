let uploadedFileContent = '';
let selectedFile = null;

const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const dropZone = document.getElementById('dropZone');
const uploadBtn = document.getElementById('uploadBtn');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#00d4ff';
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    selectedFile = e.dataTransfer.files[0];
    if (selectedFile) {
        fileName.textContent = `📄 ${selectedFile.name}`;
        fileName.style.color = '#00e5a0';
    }
});

fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        fileName.textContent = `📄 ${selectedFile.name}`;
        fileName.style.color = '#00e5a0';
    }
});

uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        alert('Pehle file select karo!');
        return;
    }

    uploadBtn.textContent = 'Uploading...';
    uploadBtn.disabled = true;

    const formData = new FormData();
    formData.append('resume', selectedFile);

    try {
        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            uploadedFileContent = data.text;
            uploadBtn.textContent = '✅ Uploaded!';
            uploadBtn.style.background = '#00e5a0';
            fileName.textContent = `✅ ${selectedFile.name} — Ready!`;
        }

    } catch (error) {
        uploadBtn.textContent = '❌ Failed!';
        uploadBtn.style.background = '#ff6b6b';
        uploadBtn.disabled = false;
    }
});

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const jobDesc = document.getElementById('jobDesc').value.trim();
    const generatedResume = document.getElementById('generatedResume');

    if (!uploadedFileContent) {
        alert('Pehle resume upload karo!');
        return;
    }

    if (!jobDesc) {
        alert('Job description paste karo!');
        return;
    }

    generatedResume.innerHTML = `<p style="color:#00d4ff;">⏳ Analyzing...</p>`;

    try {
        const response = await fetch('http://localhost:3000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume: uploadedFileContent, jobDescription: jobDesc })
        });

        const data = await response.json();
        renderResumeTemplate(data.resumeData);

    } catch (error) {
        generatedResume.innerHTML = `<p style="color:#ff6b6b;">❌ Server se connect nahi ho pa raha!</p>`;
    }
});

function renderContactLine(r) {
    const fields = [r.phone, r.email, r.linkedin, r.github, r.portfolio];
    return fields.filter(f => f && f.trim() !== '').join(' | ');
}

function renderSkillsHTML(skills) {
    return skills.map(s => `
        <div class="resume-skill-row">
            <span class="skill-label">${s.category}</span>
            <span class="skill-value">${s.items}</span>
        </div>
    `).join('');
}

function renderSectionHTML(section) {
    if (section.type === 'table') {
        const rows = section.entries.map(e => `
            <div class="resume-row">
                <div>
                    <strong>${e.left || ''}</strong><br>
                    ${e.leftSub || ''}
                </div>
                <div class="resume-right">
                    ${e.right || ''}<br>
                    ${e.rightSub || ''}
                </div>
            </div>
        `).join('');
        return `<div class="resume-section"><h3>${section.title}</h3>${rows}</div>`;
    }

    if (section.type === 'list') {
        const items = section.entries.map(e => `
            <div class="resume-project">
                <div class="resume-row">
                    <strong>${e.heading || ''}</strong>
                    <span class="resume-right">${e.subheading || ''}</span>
                </div>
                <ul>
                    ${(e.points || []).map(pt => `<li>${pt}</li>`).join('')}
                </ul>
            </div>
        `).join('');
        return `<div class="resume-section"><h3>${section.title}</h3>${items}</div>`;
    }

    if (section.type === 'bullets') {
        const items = section.entries.map(h => `<li>${h}</li>`).join('');
        return `<div class="resume-section"><h3>${section.title}</h3><ul>${items}</ul></div>`;
    }

    return '';
}

function renderResumeTemplate(r) {
    const generatedResume = document.getElementById('generatedResume');

    const contactLine = renderContactLine(r);
    const skillsHTML = renderSkillsHTML(r.skills);
    const sectionsHTML = r.sections.map(s => renderSectionHTML(s)).join('');

    generatedResume.innerHTML = `
        <div class="resume-template">
            <div class="resume-header">
                <h2>${r.name}</h2>
                <p class="resume-designation">${r.designation}</p>
                <p class="resume-contact">${contactLine}</p>
            </div>

            <div class="resume-section">
                <h3>Professional Summary</h3>
                <p>${r.summary}</p>
            </div>

            <div class="resume-section">
                <h3>Technical Skills</h3>
                ${skillsHTML}
            </div>

            ${sectionsHTML}
        </div>
    `;

    fetchJobs(r.designation);
}

async function fetchJobs(designation) {
    const jobsBox = document.getElementById('jobsBox');
    jobsBox.innerHTML = `<p style="color:#00d4ff;">⏳ Finding matching jobs...</p>`;

    try {
        const response = await fetch('http://localhost:3000/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ designation })
        });

        const data = await response.json();

        if (data.success && data.jobs.length > 0) {
            renderJobs(data.jobs);
        } else {
            jobsBox.innerHTML = `<h3>No jobs found</h3><p>Try a different resume or job description.</p>`;
        }

    } catch (error) {
        jobsBox.innerHTML = `<h3>Failed to load jobs</h3><p>Server connection issue.</p>`;
    }
}

function renderJobs(jobs) {
    const jobsBox = document.getElementById('jobsBox');

    jobsBox.innerHTML = jobs.map(job => `
        <div class="job-card">
            <h4>${job.title}</h4>
            <p class="job-company">🏢 ${job.company}</p>
            <p class="job-location">📍 ${job.location}</p>
            <p class="job-type">💼 ${job.type}</p>
            <p class="job-salary">💰 ${job.salary}</p>
            <a href="${job.applyUrl}" target="_blank" class="apply-btn">Apply Now →</a>
        </div>
    `).join('');
}

document.getElementById('downloadBtn').addEventListener('click', () => {
    const resumeTemplate = document.querySelector('.resume-template');

    if (!resumeTemplate) {
        alert('Pehle resume analyze karo!');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <style>
                @page { margin: 12mm; }
                body { font-family: 'Times New Roman', serif; padding: 0; color: #000; font-size: 0.82rem; }
                h2 { text-align: center; margin-bottom: 4px; }
                .resume-designation, .resume-contact { text-align: center; font-size: 0.82rem; }
                .resume-section { margin-top: 10px; }
                .resume-section h3 { border-bottom: 1px solid #000; padding-bottom: 3px; color: #1a4d8f; font-size: 0.92rem; margin-bottom: 6px; }
                .resume-row { display: flex; justify-content: space-between; margin: 4px 0; }
                .resume-right { text-align: right; }
                .resume-skill-row { display: flex; gap: 10px; margin: 3px 0; }
                .skill-label { font-weight: bold; min-width: 150px; }
                ul { margin-left: 18px; margin-top: 4px; }
                li { margin-bottom: 3px; font-size: 0.78rem; }
                p { font-size: 0.82rem; margin: 4px 0; }
            </style>
        </head>
        <body>${resumeTemplate.outerHTML}</body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
});