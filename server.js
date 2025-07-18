const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const fetch = require('node-fetch');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Initialize Twilio
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Utility function to create PDF as base64
const createPDFBuffer = (content) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer.toString('base64'));
    });
    doc.on('error', reject);
    
    // Add content to PDF
    doc.fontSize(20).text(content.title, 100, 100);
    doc.fontSize(12).text(content.body, 100, 150);
    
    doc.end();
  });
};

// PDF Generation Functions
const createStudentAnswersPDF = async (quiz, answers = null) => {
  const content = {
    title: 'Student Quiz Answers',
    body: `Subject: ${quiz.metadata?.subject || 'Quiz'}\nGrade: ${quiz.metadata?.grade || 'N/A'}\n\n` +
          quiz.questions.map((q, i) => 
            `Q${i+1}: ${q.question}\nAnswer: ${answers?.[i] || 'Not answered'}\n\n`
          ).join('')
  };
  return await createPDFBuffer(content);
};

const createStudyNotesPDF = async (quiz, originalContent) => {
  const content = {
    title: 'Study Notes',
    body: `Subject: ${quiz.metadata?.subject || 'Quiz'}\nGrade: ${quiz.metadata?.grade || 'N/A'}\n\n` +
          `Original Educational Content:\n${originalContent?.educationalText || 'Image content provided'}\n\n` +
          'Key Points to Study:\n' +
          quiz.questions.map((q, i) => `${i+1}. ${q.question}`).join('\n')
  };
  return await createPDFBuffer(content);
};

const createAnswerKeyPDF = async (quiz) => {
  const content = {
    title: 'Answer Key',
    body: `Subject: ${quiz.metadata?.subject || 'Quiz'}\nGrade: ${quiz.metadata?.grade || 'N/A'}\n\n` +
          quiz.questions.map((q, i) => 
            `Q${i+1}: ${q.question}\nCorrect Answer: ${q.correctAnswer}\n\n`
          ).join('')
  };
  return await createPDFBuffer(content);
};

const createLessonPlanPDF = async (quiz, originalContent) => {
  const content = {
    title: 'Teacher Lesson Plan',
    body: `Subject: ${quiz.metadata?.subject || 'Quiz'}\nGrade: ${quiz.metadata?.grade || 'N/A'}\n\n` +
          'Lesson Objectives:\n' +
          quiz.questions.map((q, i) => `${i+1}. Understand: ${q.question.replace('?', '')}`).join('\n') +
          '\n\nTeaching Materials:\n' +
          'Use the provided study notes and answer key to guide discussion.\n\n' +
          'Assessment:\n' +
          'Quiz questions provided assess student understanding of key concepts.'
  };
  return await createPDFBuffer(content);
};

const createStudyPlanPDF = async (quiz) => {
  const content = {
    title: 'Student Study Plan',
    body: `Subject: ${quiz.metadata?.subject || 'Quiz'}\nGrade: ${quiz.metadata?.grade || 'N/A'}\n\n` +
          'Study Schedule:\n' +
          'Week 1: Review basic concepts\n' +
          'Week 2: Practice questions\n' +
          'Week 3: Take quiz and review answers\n\n' +
          'Key Topics to Focus On:\n' +
          quiz.questions.map((q, i) => `${i+1}. ${q.question.replace('?', '')}`).join('\n')
  };
  return await createPDFBuffer(content);
};

// Email Templates
const getDataRecordingEmailTemplate = (payload) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #4f46e5; text-align: center; margin-bottom: 20px;">📊 Complete Data Recording - Genius Educational Software</h2>
        
        <h3 style="color: #374151;">📋 Session Details:</h3>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>School:</strong> ${payload.formData.schoolName || 'Not specified'}</p>
          <p><strong>Subject:</strong> ${payload.formData.subjectName || 'Not specified'}</p>
          <p><strong>Grade:</strong> ${payload.formData.studentGrade || 'Not specified'}</p>
        </div>
        
        <h3 style="color: #374151;">👥 Contact Information Collected:</h3>
        <ul style="background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          <li><strong>Student Email:</strong> ${payload.formData.studentEmail || 'Not provided'}</li>
          <li><strong>Teacher Email:</strong> ${payload.formData.teacherEmail || 'Not provided'}</li>
          <li><strong>Parent Email:</strong> ${payload.formData.parentEmail || 'Not provided'}</li>
          <li><strong>WhatsApp Numbers:</strong> ${[payload.formData.companyWhatsApp, payload.formData.studentWhatsApp, payload.formData.teacherWhatsApp, payload.formData.parentWhatsApp].filter(Boolean).join(', ') || 'None provided'}</li>
        </ul>
        
        ${payload.originalContent ? `
        <h3 style="color: #374151;">📚 Educational Content Used:</h3>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; max-height: 200px; overflow-y: auto;">
          <p>${payload.originalContent.educationalText ? payload.originalContent.educationalText.substring(0, 500) + '...' : 'Image content uploaded'}</p>
        </div>
        ` : ''}
        
        <h3 style="color: #374151;">📦 Generated Materials:</h3>
        <ul style="list-style-type: none; padding-left: 0;">
          <li style="padding: 5px 0;">✅ Student Quiz Answers PDF</li>
          <li style="padding: 5px 0;">✅ Study Notes PDF</li>
          <li style="padding: 5px 0;">✅ Answer Key PDF</li>
          <li style="padding: 5px 0;">✅ Teacher's Lesson Plan PDF</li>
          <li style="padding: 5px 0;">✅ Student's Study Plan PDF</li>
        </ul>
        
        <p style="margin-top: 30px; color: #6b7280; text-align: center;">
          Complete session data recorded and distributed successfully.
        </p>
      </div>
    </div>
  `;
};

const getCompanyEmailTemplate = (formData) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #4f46e5; text-align: center; margin-bottom: 20px;">🏫 Complete Educational Package Generated</h2>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>School:</strong> ${formData.schoolName || 'Not specified'}</p>
          <p><strong>Subject:</strong> ${formData.subjectName || 'Not specified'}</p>
          <p><strong>Grade:</strong> ${formData.studentGrade || 'Not specified'}</p>
        </div>
        
        <h3 style="color: #374151;">📦 Package Contents:</h3>
        <ul style="list-style-type: none; padding-left: 0;">
          <li style="padding: 5px 0;">✅ Student Quiz Answers</li>
          <li style="padding: 5px 0;">✅ Study Notes</li>
          <li style="padding: 5px 0;">✅ Answer Key</li>
          <li style="padding: 5px 0;">✅ Teacher's Lesson Plan</li>
          <li style="padding: 5px 0;">✅ Student's Study Plan</li>
        </ul>
        
        <p style="margin-top: 30px; color: #6b7280;">All materials have been distributed according to your settings.</p>
        <p style="color: #4f46e5; font-weight: bold; text-align: center; margin-top: 20px;">Generated by Genius Educational Software</p>
      </div>
    </div>
  `;
};

const getTeacherEmailTemplate = (formData) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #7c3aed; text-align: center; margin-bottom: 20px;">👨‍🏫 Teaching Materials Ready</h2>
        <p style="font-size: 16px; color: #374151;">Dear Teacher,</p>
        <p style="color: #6b7280;">Here are the teaching materials for <strong>${formData.subjectName || 'the quiz'}</strong>:</p>
        
        <h3 style="color: #374151;">📚 Attached Materials:</h3>
        <ul style="list-style-type: none; padding-left: 0; background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          <li style="padding: 5px 0;">📝 Student Quiz Answers (for grading)</li>
          <li style="padding: 5px 0;">📖 Study Notes (teaching context)</li>
          <li style="padding: 5px 0;">🔑 Answer Key (grading guide)</li>
          <li style="padding: 5px 0;">📋 Lesson Plan (structured approach)</li>
        </ul>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>School:</strong> ${formData.schoolName || 'Not specified'}</p>
          <p><strong>Grade:</strong> ${formData.studentGrade || 'Not specified'}</p>
        </div>
        
        <p style="margin-top: 30px; color: #6b7280;">Best regards,<br><strong style="color: #7c3aed;">Genius Educational Software</strong></p>
      </div>
    </div>
  `;
};

const getParentEmailTemplate = (formData) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #ec4899; text-align: center; margin-bottom: 20px;">👨‍👩‍👧‍👦 Your Child's Quiz Results</h2>
        <p style="font-size: 16px; color: #374151;">Dear Parent,</p>
        <p style="color: #6b7280;">Your child has completed a quiz in <strong>${formData.subjectName || 'their subject'}</strong>.</p>
        
        <h3 style="color: #374151;">📋 Attached Documents:</h3>
        <ul style="list-style-type: none; padding-left: 0; background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          <li style="padding: 5px 0;">📝 Quiz Answers (your child's responses)</li>
          <li style="padding: 5px 0;">🔑 Answer Key (to help review with your child)</li>
          <li style="padding: 5px 0;">📖 Study Plan (for continued learning)</li>
        </ul>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>School:</strong> ${formData.schoolName || 'Not specified'}</p>
          <p><strong>Grade:</strong> ${formData.studentGrade || 'Not specified'}</p>
        </div>
        
        <p style="color: #6b7280;">Use the answer key to help your child understand any mistakes and learn from them.</p>
        <p style="margin-top: 30px; color: #6b7280;">Best regards,<br><strong style="color: #ec4899;">Genius Educational Software</strong></p>
      </div>
    </div>
  `;
};

const getStudentEmailTemplate = (formData) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #10b981; text-align: center; margin-bottom: 20px;">🎓 Your Quiz Results</h2>
        <p style="font-size: 16px; color: #374151;">Hello!</p>
        <p style="color: #6b7280;">Here are your answers for the <strong>${formData.subjectName || 'quiz'}</strong> you just completed.</p>
        
        <h3 style="color: #374151;">📝 What's Attached:</h3>
        <ul style="list-style-type: none; padding-left: 0; background-color: #f3f4f6; padding: 15px; border-radius: 8px;">
          <li style="padding: 5px 0;">Your quiz responses for review</li>
          <li style="padding: 5px 0;">Study plan for continued learning</li>
        </ul>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Subject:</strong> ${formData.subjectName || 'Not specified'}</p>
          <p><strong>Grade:</strong> ${formData.studentGrade || 'Not specified'}</p>
        </div>
        
        <p style="color: #6b7280;">Review your answers and discuss any questions with your teacher or parents.</p>
        <p style="margin-top: 30px; color: #6b7280;">Keep learning!<br><strong style="color: #10b981;">Genius Educational Software</strong></p>
      </div>
    </div>
  `;
};

// ROUTES

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Genius Educational Software Backend API',
    status: 'Running',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      generateQuiz: '/api/generate-quiz',
      sendMaterials: '/api/send-quiz-materials',
      health: '/health'
    }
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      sendgrid: process.env.SENDGRID_API_KEY ? 'configured' : 'missing',
      twilio: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'missing',
      claude: process.env.CLAUDE_API_KEY ? 'configured' : 'missing'
    }
  });
});

// NEW: Generate quiz from educational content
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { content, contentType, numberOfQuestions, subject, grade } = req.body;
    
    console.log('🧠 Generating quiz with Claude API...');
    
    // Prepare content for Claude
    let claudeContent = '';
    if (contentType === 'image') {
      claudeContent = `Based on this educational image content, create ${numberOfQuestions} multiple choice questions for ${subject} (Grade ${grade}).`;
    } else {
      claudeContent = `Based on this educational content: "${content}", create ${numberOfQuestions} multiple choice questions for ${subject} (Grade ${grade}).`;
    }
    
    // Call Claude API
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CLAUDE_API_KEY,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `${claudeContent}

Format your response as JSON only:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }
  ]
}

Make sure the questions are appropriate for the grade level and subject. Each question should have exactly 4 options.`
        }]
      })
    });
    
    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }
    
    const data = await claudeResponse.json();
    console.log('🤖 Claude response received');
    
    // Parse Claude's response
    let quizData;
    try {
      const responseText = data.content[0].text;
      // Clean the response to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        quizData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in Claude response');
      }
    } catch (parseError) {
      console.error('Error parsing Claude response:', parseError);
      // Fallback: create sample questions
      quizData = {
        questions: Array.from({ length: numberOfQuestions }, (_, i) => ({
          question: `Sample Question ${i + 1} for ${subject}?`,
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctAnswer: "Option A"
        }))
      };
    }
    
    const quiz = {
      id: Date.now(),
      ...quizData,
      metadata: { 
        subject, 
        grade, 
        createdAt: new Date().toISOString(),
        contentType
      }
    };
    
    console.log(`✅ Quiz generated with ${quiz.questions.length} questions`);
    
    res.json({
      success: true,
      quiz: quiz
    });
    
  } catch (error) {
    console.error('💥 Error generating quiz:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Failed to generate quiz'
    });
  }
});

// UPDATED: Send quiz materials (now with AI generation support)
app.post('/api/send-quiz-materials', async (req, res) => {
  try {
    const {
      formData,
      studentAnswersPDF,
      studyNotesPDF,
      answerKeyPDF,
      lessonPlanPDF,
      studyPlanPDF,
      originalContent
    } = req.body;

    console.log('📧 Processing quiz materials distribution...');
    console.log('📊 Form data:', formData);

    const results = {
      emails: [],
      whatsapp: [],
      errors: []
    };

    // If we have original content, generate quiz and PDFs
    let finalPDFs = {
      studentAnswersPDF,
      studyNotesPDF,
      answerKeyPDF,
      lessonPlanPDF,
      studyPlanPDF
    };

    if (originalContent && originalContent.generatedQuiz) {
      console.log('🎯 Generating PDFs from quiz data...');
      try {
        const quiz = originalContent.generatedQuiz;
        
        finalPDFs.studentAnswersPDF = await createStudentAnswersPDF(quiz);
        finalPDFs.studyNotesPDF = await createStudyNotesPDF(quiz, originalContent);
        finalPDFs.answerKeyPDF = await createAnswerKeyPDF(quiz);
        finalPDFs.lessonPlanPDF = await createLessonPlanPDF(quiz, originalContent);
        finalPDFs.studyPlanPDF = await createStudyPlanPDF(quiz);
        
        console.log('✅ PDFs generated successfully');
      } catch (pdfError) {
        console.error('❌ PDF generation error:', pdfError);
        results.errors.push(`PDF generation failed: ${pdfError.message}`);
      }
    }

    // Prepare email attachments
    const getAttachment = (content, filename) => ({
      content: content,
      filename: filename,
      type: 'application/pdf',
      disposition: 'attachment'
    });

    // 1. ALWAYS send comprehensive data to paulusiipinge@gmail.com
    try {
      await sgMail.send({
        to: 'paulusiipinge@gmail.com',
        from: 'paulusiipinge@gmail.com', // Use your verified email
        subject: `📊 Data Recording - ${formData.subjectName || 'Quiz Session'} - ${new Date().toLocaleDateString()}`,
        html: getDataRecordingEmailTemplate({ formData, originalContent }),
        attachments: [
          getAttachment(finalPDFs.studentAnswersPDF, `Complete_Session_Data_${Date.now()}.pdf`),
          getAttachment(finalPDFs.studyNotesPDF, `Study_Notes_${Date.now()}.pdf`),
          getAttachment(finalPDFs.answerKeyPDF, `Answer_Key_${Date.now()}.pdf`),
          getAttachment(finalPDFs.lessonPlanPDF, `Lesson_Plan_${Date.now()}.pdf`),
          getAttachment(finalPDFs.studyPlanPDF, `Study_Plan_${Date.now()}.pdf`)
        ]
      });
      results.emails.push(`✅ Data recording email sent to paulusiipinge@gmail.com`);
      console.log(`✅ Data recording email sent to paulusiipinge@gmail.com`);
    } catch (error) {
      results.errors.push(`❌ Data recording email failed: ${error.message}`);
      console.error(`❌ Data recording email failed:`, error);
    }

    // 2. Send complete package to company email (if different)
    if (formData.companyEmail && formData.companyEmail !== 'paulusiipinge@gmail.com') {
      try {
        await sgMail.send({
          to: formData.companyEmail,
          from: 'paulusiipinge@gmail.com',
          subject: `📚 Complete Educational Package - ${formData.subjectName || 'Quiz'}`,
          html: getCompanyEmailTemplate(formData),
          attachments: [
            getAttachment(finalPDFs.studentAnswersPDF, `Student_Answers_${Date.now()}.pdf`),
            getAttachment(finalPDFs.studyNotesPDF, `Study_Notes_${Date.now()}.pdf`),
            getAttachment(finalPDFs.answerKeyPDF, `Answer_Key_${Date.now()}.pdf`),
            getAttachment(finalPDFs.lessonPlanPDF, `Lesson_Plan_${Date.now()}.pdf`),
            getAttachment(finalPDFs.studyPlanPDF, `Study_Plan_${Date.now()}.pdf`)
          ]
        });
        results.emails.push(`✅ Company email sent to ${formData.companyEmail}`);
        console.log(`✅ Company email sent to ${formData.companyEmail}`);
      } catch (error) {
        results.errors.push(`❌ Company email failed: ${error.message}`);
        console.error(`❌ Company email failed:`, error);
      }
    }

    // 3. Send teaching materials to teacher
    if (formData.teacherEmail) {
      try {
        await sgMail.send({
          to: formData.teacherEmail,
          from: 'paulusiipinge@gmail.com',
          subject: `👨‍🏫 Teaching Materials - ${formData.subjectName || 'Quiz'}`,
          html: getTeacherEmailTemplate(formData),
          attachments: [
            getAttachment(finalPDFs.studentAnswersPDF, `Student_Answers_${Date.now()}.pdf`),
            getAttachment(finalPDFs.studyNotesPDF, `Study_Notes_${Date.now()}.pdf`),
            getAttachment(finalPDFs.answerKeyPDF, `Answer_Key_${Date.now()}.pdf`),
            getAttachment(finalPDFs.lessonPlanPDF, `Lesson_Plan_${Date.now()}.pdf`)
          ]
        });
        results.emails.push(`✅ Teacher email sent to ${formData.teacherEmail}`);
        console.log(`✅ Teacher email sent to ${formData.teacherEmail}`);
      } catch (error) {
        results.errors.push(`❌ Teacher email failed: ${error.message}`);
        console.error(`❌ Teacher email failed:`, error);
      }
    }

    // 4. Send review materials to parent
    if (formData.parentEmail) {
      try {
        await sgMail.send({
          to: formData.parentEmail,
          from: 'paulusiipinge@gmail.com',
          subject: `👨‍👩‍👧‍👦 Quiz Results - ${formData.subjectName || 'Quiz'}`,
          html: getParentEmailTemplate(formData),
          attachments: [
            getAttachment(finalPDFs.studentAnswersPDF, `Student_Answers_${Date.now()}.pdf`),
            getAttachment(finalPDFs.answerKeyPDF, `Answer_Key_${Date.now()}.pdf`),
            getAttachment(finalPDFs.studyPlanPDF, `Study_Plan_${Date.now()}.pdf`)
          ]
        });
        results.emails.push(`✅ Parent email sent to ${formData.parentEmail}`);
        console.log(`✅ Parent email sent to ${formData.parentEmail}`);
      } catch (error) {
        results.errors.push(`❌ Parent email failed: ${error.message}`);
        console.error(`❌ Parent email failed:`, error);
      }
    }

    // 5. Send quiz results to student
    if (formData.studentEmail) {
      try {
        await sgMail.send({
          to: formData.studentEmail,
          from: 'paulusiipinge@gmail.com',
          subject: `🎓 Your Quiz Results - ${formData.subjectName || 'Quiz'}`,
          html: getStudentEmailTemplate(formData),
          attachments: [
            getAttachment(finalPDFs.studentAnswersPDF, `My_Quiz_Results_${Date.now()}.pdf`),
            getAttachment(finalPDFs.studyPlanPDF, `My_Study_Plan_${Date.now()}.pdf`)
          ]
        });
        results.emails.push(`✅ Student email sent to ${formData.studentEmail}`);
        console.log(`✅ Student email sent to ${formData.studentEmail}`);
      } catch (error) {
        results.errors.push(`❌ Student email failed: ${error.message}`);
        console.error(`❌ Student email failed:`, error);
      }
    }

    // WhatsApp Notifications
    const twilioWhatsAppNumber = 'whatsapp:+14155238886'; // Your Twilio sandbox number

    // Send WhatsApp notifications (same as before, but with better error handling)
    const whatsappTargets = [
      { number: formData.companyWhatsApp, type: 'company' },
      { number: formData.teacherWhatsApp, type: 'teacher' },
      { number: formData.parentWhatsApp, type: 'parent' },
      { number: formData.studentWhatsApp, type: 'student' }
    ];

    for (const target of whatsappTargets) {
      if (target.number) {
        try {
          const messages = {
            company: `🏫 *Genius Educational Software*\n\n✅ Complete educational package generated!\n\n📚 Subject: ${formData.subjectName || 'Quiz'}\n🎓 Grade: ${formData.studentGrade || 'Not specified'}\n\nAll materials sent to: ${formData.companyEmail}`,
            teacher: `👨‍🏫 *Teaching Materials Ready*\n\nNew materials for:\n📚 Subject: ${formData.subjectName || 'Quiz'}\n🎓 Grade: ${formData.studentGrade || 'Not specified'}\n\nCheck your email: ${formData.teacherEmail}`,
            parent: `👨‍👩‍👧‍👦 *Quiz Results Available*\n\nYour child completed a quiz:\n📚 Subject: ${formData.subjectName || 'Quiz'}\n\nCheck your email: ${formData.parentEmail}`,
            student: `🎓 *Quiz Completed!*\n\nGreat job on your quiz!\n📚 Subject: ${formData.subjectName || 'Quiz'}\n\nCheck your email: ${formData.studentEmail}`
          };

          await twilioClient.messages.create({
            from: twilioWhatsAppNumber,
            to: `whatsapp:${target.number}`,
            body: messages[target.type]
          });
          
          results.whatsapp.push(`✅ ${target.type} WhatsApp sent to ${target.number}`);
          console.log(`✅ ${target.type} WhatsApp sent to ${target.number}`);
        } catch (error) {
          results.errors.push(`❌ ${target.type} WhatsApp failed: ${error.message}`);
          console.error(`❌ ${target.type} WhatsApp failed:`, error);
        }
      }
    }

    console.log('📊 Final Results:', results);

    // Return response
    res.json({
      success: true,
      message: 'Quiz materials processed and distributed successfully!',
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error in send-quiz-materials:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to send quiz materials',
      timestamp: new Date().toISOString()
    });
  }
});

// Handle 404 for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist on this server`,
    availableRoutes: ['/', '/health', '/api/generate-quiz', '/api/send-quiz-materials']
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Genius Educational Software Backend v2.0 running on port ${PORT}`);
  console.log(`📧 SendGrid API Key: ${process.env.SENDGRID_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`📱 Twilio Account SID: ${process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Missing'}`);
  console.log(`🧠 Claude API Key: ${process.env.CLAUDE_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`🌍 Server accepting connections on 0.0.0.0:${PORT}`);
  console.log(`📍 Health check: /health`);
  console.log(`🔗 API endpoints: /api/generate-quiz, /api/send-quiz-materials`);
});
