const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();


// Add this debug code:
console.log('Environment variables loaded:');
console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
console.log('EMAIL_APP_PASSWORD exists:', !!process.env.EMAIL_APP_PASSWORD);
console.log('FIRM_EMAIL exists:', !!process.env.FIRM_EMAIL);
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration - Update this with your frontend domain
app.use(cors({
  origin: process.env.FRONTEND_URL || 'mrs-co1.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 ADD THIS ROOT ROUTE HERE
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'MRS & Co. Backend API',
    status: 'Server is running successfully!',
    endpoints: {
      'GET /': 'API Information',
      'GET /api/health': 'Health check',
      'GET /api/test-email': 'Test email configuration',
      'POST /api/consultation': 'Submit consultation form (requires: name, email, message)',
      'POST /api/careers': 'Submit career application (requires: name, email)'
    },
    timestamp: new Date().toISOString()
  });
});

// Email transporter setup
const createTransporter = () => {
console.log('Creating transporter with:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_APP_PASSWORD length:', process.env.EMAIL_APP_PASSWORD?.length);
  console.log('FIRM_EMAIL:', process.env.FIRM_EMAIL);
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD // Use App Password, not regular password
    }
  });
};
// Add this test function
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email connection successful!');
  } catch (error) {
    console.error('❌ Email connection failed:', error.message);
  }
};

// Call it when server starts (add this before app.listen)
testEmailConnection();

// Email templates
const getConsultationEmailTemplate = (data) => {
  return {
    subject: `New Consultation Request from ${data.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3B82F6, #1E40AF); padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">New Consultation Request</h2>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <h3 style="color: #1E40AF; margin-bottom: 20px;">Client Details</h3>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 8px 0;"><strong>Name:</strong> ${data.name}</p>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin: 8px 0;"><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
            <p style="margin: 8px 0;"><strong>Company:</strong> ${data.company || 'Not provided'}</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px;">
            <h4 style="color: #1E40AF; margin-top: 0;">Message:</h4>
            <p style="line-height: 1.6; color: #374151;">${data.message}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #EBF8FF; border-radius: 8px;">
            <p style="margin: 0; color: #1E40AF; font-size: 14px;">
              <strong>Submitted:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </p>
          </div>
        </div>
      </div>
    `
  };
};

const getCareerEmailTemplate = (data) => {
  return {
    subject: `New Job Application - ${data.role || 'General Application'}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">New Job Application</h2>
        </div>
        
        <div style="padding: 20px; background: #f8f9fa;">
          <h3 style="color: #059669; margin-bottom: 20px;">Applicant Details</h3>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 8px 0;"><strong>Name:</strong> ${data.name}</p>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin: 8px 0;"><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
            <p style="margin: 8px 0;"><strong>Role Applied For:</strong> ${data.role || 'Not specified'}</p>
          </div>
          
          ${data.notes ? `
          <div style="background: white; padding: 20px; border-radius: 8px;">
            <h4 style="color: #059669; margin-top: 0;">Additional Notes:</h4>
            <p style="line-height: 1.6; color: #374151;">${data.notes}</p>
          </div>
          ` : ''}
          
          <div style="margin-top: 20px; padding: 15px; background: #ECFDF5; border-radius: 8px;">
            <p style="margin: 0; color: #059669; font-size: 14px;">
              <strong>Submitted:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </p>
          </div>
        </div>
      </div>
    `
  };
};

// Validation middleware
const validateConsultationData = (req, res, next) => {
  const { name, email, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and message are required fields'
    });
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }
  
  next();
};

const validateCareerData = (req, res, next) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Name and email are required fields'
    });
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }
  
  next();
};

// Routes
// Add this route before your existing routes
app.get('/api/test-email', async (req, res) => {
  try {
    const transporter = createTransporter();
    
    // Verify connection
    await transporter.verify();
    
    // Send test email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: 'Test Email from MRS Backend',
      text: 'If you receive this, your email configuration is working!'
    });
    
    res.json({ success: true, message: 'Test email sent successfully!' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Consultation form endpoint
app.post('/api/consultation', validateConsultationData, async (req, res) => {
  try {
    const { name, email, phone, company, message } = req.body;
    
    const transporter = createTransporter();
    const emailTemplate = getConsultationEmailTemplate({ name, email, phone, company, message });
    
    // Send email to your firm
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.FIRM_EMAIL,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });
    
    // Send confirmation email to client
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Thank you for contacting MRS & Co.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3B82F6, #1E40AF); padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">Thank You for Reaching Out!</h2>
          </div>
          
          <div style="padding: 20px;">
            <p>Dear ${name},</p>
            
            <p>Thank you for your interest in MRS & Co. We have received your consultation request and will get back to you within 1 business day.</p>
            
            <p>Our team will review your requirements and provide you with the best possible solution.</p>
            
            <div style="background: #EBF8FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #1E40AF;"><strong>What happens next?</strong></p>
              <ul style="color: #374151; margin: 10px 0;">
                <li>Our team will review your request</li>
                <li>We'll schedule a call at your convenience</li>
                <li>We'll provide a customized solution for your needs</li>
              </ul>
            </div>
            
            <p>Best regards,<br>
            <strong>Team MRS & Co.</strong><br>
            Chartered Accountants</p>
            
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6B7280;">
              This is an automated response. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    });
    
    res.json({
      success: true,
      message: 'Your consultation request has been submitted successfully. We will contact you soon!'
    });
    
  } catch (error) {
    console.error('Consultation form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit consultation request. Please try again later.'
    });
  }
});

// Career application endpoint
app.post('/api/careers', validateCareerData, async (req, res) => {
  try {
    const { name, email, phone, role, notes } = req.body;
    
    const transporter = createTransporter();
    const emailTemplate = getCareerEmailTemplate({ name, email, phone, role, notes });
    
    // Send email to your firm
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.FIRM_EMAIL,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });
    
    // Send confirmation email to applicant
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Application Received - MRS & Co.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10B981, #059669); padding: 20px; text-align: center;">
            <h2 style="color: white; margin: 0;">Application Received</h2>
          </div>
          
          <div style="padding: 20px;">
            <p>Dear ${name},</p>
            
            <p>Thank you for your interest in joining MRS & Co. We have received your application${role ? ` for the position of <strong>${role}</strong>` : ''} and appreciate you taking the time to apply.</p>
            
            <div style="background: #ECFDF5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #059669;"><strong>Next Steps:</strong></p>
              <ul style="color: #374151; margin: 10px 0;">
                <li>Our HR team will review your application</li>
                <li>If shortlisted, we'll contact you for further discussions</li>
                <li>We'll keep your application on file for future opportunities</li>
              </ul>
            </div>
            
            <p>We'll be in touch if your profile matches our current requirements.</p>
            
            <p>Best regards,<br>
            <strong>HR Team - MRS & Co.</strong><br>
            Chartered Accountants</p>
            
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6B7280;">
              This is an automated response. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    });
    
    res.json({
      success: true,
      message: 'Your application has been submitted successfully. We will contact you if your profile matches our requirements.'
    });
    
  } catch (error) {
    console.error('Career form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit application. Please try again later.'
    });
  }
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
});