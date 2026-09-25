const sendEmail = require('../utils/sendEmail');
const GlobalSettings = require('../Model/GlobalSettings');
const ContactSubmission = require('../Model/ContactSubmission');
const Product = require('../Model/ProductModel');
const axios = require('axios');

exports.submitContactForm = async (req, res) => {
  try {
    const { 
      fullName, firstName, 
      email, phone, subject, 
      message, comment, 
      company, acreage, products, 
      recaptchaToken 
    } = req.body;
    
    // Support both sets of variables
    const finalName = fullName || firstName;
    const finalMessage = message || comment;
    
    if (!recaptchaToken) {
      return res.status(400).json({ success: false, message: 'reCAPTCHA token is missing. Please refresh and try again.' });
    }

    const secretKey = process.env.GOOGLE_CAPTCHA_SECRET;
    const recaptchaRes = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`);
    
    if (!recaptchaRes.data.success || recaptchaRes.data.score < 0.5) {
      return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed. Bots are not allowed.' });
    }

    const settings = await GlobalSettings.findOne({ settingsId: "site_settings" });
    const adminEmails = [];
    if (settings) {
      if (settings.adminEmail1) adminEmails.push(settings.adminEmail1);
      if (settings.adminEmail2) adminEmails.push(settings.adminEmail2);
    }
    
    const fallbackEmail = 'kaverigoatform@gmail.com'; 
    const toEmail = adminEmails.length > 0 ? adminEmails : fallbackEmail;

    // Save to Database first so we get the _id and submission date
    const submissionType = (acreage || company || (products && products.length > 0)) ? 'bulkorder' : 'contact';
    const newSubmission = await ContactSubmission.create({
      fullName: finalName,
      email,
      phone,
      subject,
      message: finalMessage,
      company,
      acreage,
      products: products || [],
      type: submissionType
    });
    
    // Fetch products for email
    let productRowsHTML = '<tr><td colspan="2" style="padding:12px 14px; color:#6b7280; font-size:14px;">No products selected</td></tr>';
    if (products && products.length > 0) {
      const foundProducts = await Product.find({ _id: { $in: products } });
      productRowsHTML = foundProducts.map((product, index) => {
        const pName = typeof product.name === 'object' ? (product.name.en || product.name) : product.name;
        return `
          <tr> 
            <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; font-size:14px;"> ${index + 1} </td> 
            <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; font-size:14px; font-weight:600;"> ${pName} </td> 
          </tr>
        `;
      }).join("");
    }

    const emailSubject = `New ${submissionType === 'bulkorder' ? 'Bulk Order' : 'Contact'} Inquiry: ${finalName || 'General Inquiry'}`;
    const dashboardBase = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5173';
    
    // Use the last 6 chars of the ID as a pseudo LEAD-ID
    const leadIdStr = `LEAD-${newSubmission._id.toString().slice(-6).toUpperCase()}`;
    const dashboardUrl = `https://supernapier.in/dashboard/leads?id=${newSubmission._id}`; // Just point to dashboard for now
    const submittedAt = new Date(newSubmission.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const htmlContent = `
<!DOCTYPE html> <html lang="en"> <head> <meta charset="UTF-8" /> <meta name="viewport" content="width=device-width, initial-scale=1.0" /> <title>New Inquiry</title> </head> <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#1f2937;"> <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8; padding:40px 15px;"> <tr> <td align="center"> <!-- Main Container --> <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden;"> <!-- Header --> <tr> <td style="background:#111827; padding:28px 32px; text-align:center;"> <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700;"> SuperNapier </h1> <p style="margin:8px 0 0; color:#d1d5db; font-size:14px;"> New ${submissionType === 'bulkorder' ? 'Bulk Order' : 'Contact'} Inquiry </p> </td> </tr> <!-- Alert --> <tr> <td style="padding:28px 32px 10px;"> <table width="100%" cellpadding="0" cellspacing="0" border="0"> <tr> <td style="background:#fff7ed; border-left:4px solid #f97316; padding:16px 18px;"> <p style="margin:0; font-size:15px; color:#9a3412; font-weight:600;"> New inquiry received </p> <p style="margin:6px 0 0; font-size:13px; color:#7c2d12;"> A customer has submitted an inquiry through your website. </p> </td> </tr> </table> </td> </tr> <!-- Customer Details --> <tr> <td style="padding:20px 32px 10px;"> <h2 style="margin:0 0 16px; font-size:18px; color:#111827;"> Customer Details </h2> <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb; border-radius:8px;"> <tr> <td style="padding:13px 16px; border-bottom:1px solid #e5e7eb; width:35%; color:#6b7280; font-size:13px;"> Name </td> <td style="padding:13px 16px; border-bottom:1px solid #e5e7eb; font-size:14px; font-weight:600;"> ${finalName || 'N/A'} </td> </tr> <tr> <td style="padding:13px 16px; border-bottom:1px solid #e5e7eb; color:#6b7280; font-size:13px;"> Email </td> <td style="padding:13px 16px; border-bottom:1px solid #e5e7eb; font-size:14px;"> <a href="mailto:${email}" style="color:#2563eb; text-decoration:none;"> ${email || 'N/A'} </a> </td> </tr> <tr> <td style="padding:13px 16px; color:#6b7280; font-size:13px;"> Phone </td> <td style="padding:13px 16px; font-size:14px;"> <a href="tel:${phone}" style="color:#2563eb; text-decoration:none;"> ${phone || 'N/A'} </a> </td> </tr> 
${company ? `<tr> <td style="padding:13px 16px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:13px;"> Company </td> <td style="padding:13px 16px; border-top:1px solid #e5e7eb; font-size:14px;"> ${company} </td> </tr>` : ''}
${acreage ? `<tr> <td style="padding:13px 16px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:13px;"> Acreage </td> <td style="padding:13px 16px; border-top:1px solid #e5e7eb; font-size:14px;"> ${acreage} </td> </tr>` : ''}
</table> </td> </tr> <!-- Order Requirement --> <tr> <td style="padding:20px 32px 10px;"> <h2 style="margin:0 0 16px; font-size:18px; color:#111827;"> Requirement / Message </h2> <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;"> <tr> <td style="padding:16px;"> <p style="margin:0; font-size:16px; line-height:1.6; color:#111827;"> ${finalMessage || 'N/A'} </p> </td> </tr> </table> </td> </tr> <!-- Products --> 
${submissionType === 'bulkorder' ? `
<tr> <td style="padding:20px 32px 10px;"> <h2 style="margin:0 0 16px; font-size:18px; color:#111827;"> Products Interested In </h2> <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"> <tr style="background:#f3f4f6;"> <th align="left" style="padding:12px 14px; font-size:12px; color:#6b7280; text-transform:uppercase;"> # </th> <th align="left" style="padding:12px 14px; font-size:12px; color:#6b7280; text-transform:uppercase;"> Product </th> </tr> ${productRowsHTML} </table> </td> </tr>
` : ''}
<!-- Lead Information --> <tr> <td style="padding:20px 32px;"> <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb; border-radius:8px;"> <tr> <td style="padding:14px 16px;"> <p style="margin:0 0 5px; font-size:12px; color:#6b7280;"> Lead ID </p> <p style="margin:0; font-size:14px; font-weight:600;"> ${leadIdStr} </p> </td> <td style="padding:14px 16px;"> <p style="margin:0 0 5px; font-size:12px; color:#6b7280;"> Inquiry Type </p> <p style="margin:0; font-size:14px; font-weight:600; text-transform:capitalize;"> ${submissionType} </p> </td> <td style="padding:14px 16px;"> <p style="margin:0 0 5px; font-size:12px; color:#6b7280;"> Submitted </p> <p style="margin:0; font-size:14px; font-weight:600;"> ${submittedAt} </p> </td> </tr> </table> </td> </tr> <!-- CTA --> <tr> <td align="center" style="padding:10px 32px 32px;"> <a href="${dashboardUrl}" style=" display:inline-block; background:#111827; color:#ffffff; text-decoration:none; padding:13px 26px; border-radius:7px; font-size:14px; font-weight:600; "> View Inquiry in Dashboard </a> </td> </tr> <!-- Footer --> <tr> <td style="background:#f9fafb; padding:22px 32px; text-align:center; border-top:1px solid #e5e7eb;"> <p style="margin:0 0 6px; font-size:13px; color:#374151; font-weight:600;"> SuperNapier </p> <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.5;"> This is an automated notification from the SuperNapier website. <br /> Please do not reply directly to this email. </p> </td> </tr> </table> </td> </tr> </table> </body> </html>
    `;
    const textContent = `New submission from ${finalName || 'N/A'}. Email: ${email}, Phone: ${phone}, Message: ${finalMessage}`;

    await sendEmail(toEmail, emailSubject, htmlContent, textContent);
    
    res.status(200).json({ success: true, message: 'Your message has been sent successfully!' });
  } catch (error) {
    console.error('Contact Form Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again later.' });
  }
};

exports.getSubmissions = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, search, startDate, endDate, export: exportCSV } = req.query;

    const query = {};

    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (exportCSV === 'true') {
      const submissions = await ContactSubmission.find(query).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: submissions });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await ContactSubmission.countDocuments(query);
    const submissions = await ContactSubmission.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('products', 'name');

    res.status(200).json({
      success: true,
      data: submissions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('getSubmissions error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving submissions' });
  }
};

exports.updateSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['new', 'contacted', 'converted'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const submission = await ContactSubmission.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    console.error('updateSubmissionStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error updating submission' });
  }
};
