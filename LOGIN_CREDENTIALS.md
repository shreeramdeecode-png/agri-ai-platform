# AgriSearch Login Credentials

## Admin Panel
**URL:** `/admin` or click "Admin Login" 

**Admin Credentials:**
- Email: `admin@agrisearch.com`
- Password: `admin123`

## User Website
**URL:** `/` (homepage)

**Test User Credentials:**
- Email: `user@agrisearch.com`
- Password: `user123`

## Creating New Accounts

### For Users:
1. Go to the homepage `/`
2. Click "Don't have an account? Sign up"
3. Fill in your details (email, password, full name)
4. Click "Sign Up"

### For Admin:
Admin accounts can only be created through direct database access or by modifying the seed script.

## Features

### User Panel Features:
- **Search**: Natural language search for agriculture data
- **Documents**: Upload and manage PDF documents
- **Images**: Upload and analyze agricultural images
- **History**: View search history with source tracking
- **Profile**: Update your account information

### Admin Panel Features:
- **Dashboard**: View platform statistics
- **User Management**: Activate/deactivate/delete users
- **Document Management**: View all uploaded documents and images
- **Logs**: View search history and admin actions
- **Settings**: Configure API keys for external services

## Getting Started

1. Sign up for a new user account or use the test credentials above
2. Upload some PDF documents related to agriculture
3. Upload agricultural images for AI analysis
4. Try natural language searches like:
   - "What is the wheat production in Kenya for 2023?"
   - "Show me climate data for East Africa"
   - "What are the food security levels in Ethiopia?"

## Notes

- The system uses OpenAI GPT-4o for natural language processing
- Search results combine data from APIs, PDFs, and images
- All uploaded files are analyzed using AI
- Admin can manage all users, documents, and view detailed logs
