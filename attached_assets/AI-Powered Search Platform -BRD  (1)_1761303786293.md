## **Business Requirement Document (BRD)**

**Project Title:**  
 **AI-Powered Search Platform with Agriculture Domain Agent**

### **1\. Project Overview**

The **AI-Powered Search Platform** is a web-based application that enables users to search **agriculture, climate, and market data** from verified external APIs using natural language queries.

The system uses **OpenAI GPT** to interpret user intent, route the query to a **domain-specific agent** (Agriculture), and fetch results from external APIs and/or uploaded PDF documents.

Additionally, users can upload **PDF documents** for the AI to read and answer questions from. Basic **image interpretation** is also supported using **OpenAI GPT-4o/GPT-4 vision** for extracting relevant text or data from uploaded images (no image generation/editing).

The platform includes:

* **Website (User Panel)** for search, query history, PDF/image upload.

* **Secure Admin Panel** to manage users, view logs, configure settings, and manage documents.

* **One active domain-specific agent (Agriculture)** with a router mechanism for future expansion to other domains.

### **2\. Project Goals**

* Enable **natural-language search** using OpenAI GPT.

* Provide **reliable and fast access** to structured public agriculture API data.

* Allow **document-based queries** by reading uploaded PDFs.

* Allow **basic image understanding** for extracting text/data.

* Implement **router \+ single agriculture agent**, with the ability to add more domain agents in the future.

* Maintain transparency and control via an **admin backend**.

### **3\. Technical Stack**

| Component | Technology |
| ----- | ----- |
| Frontend (Web) | React.js \+ Tailwind |
| Backend API | Node.js \+ Express |
| AI Layer | OpenAI GPT-4o / GPT-4 Vision API |
| PDF Processing | Server-side PDF parser (e.g., pdf-parse / PyMuPDF) |
| Image Understanding | OpenAI GPT-4o/GPT-4 Vision (basic reading/interpretation only) |
| Auth | JWT-based Authentication (if url main domain \- website , maindomain/admin \- admin panel) |
| Admin Dashboard | React.js Secure Routes |
| Hosting | Cloud Deployment |
| Database | PostgreSQL |

### **4\. Scope of Work**

#### **4.1 Website – User Panel**

**Module 1: Login & Sign-Up**

* Email/password registration with validations.

* Secure login and JWT-based session management.

* Forgot/reset password via email.

**Module 2: Natural Language Search**

* Free-text search box.

* Integration with OpenAI GPT for intent extraction:

  * Crop

  * Country/Region

  * Date or time range

* Router classifies query to Agriculture agent.

* Agriculture agent matches query to external APIs or PDF context.

* Hybrid query handling (merge API \+ PDF results).

**Module 3: PDF Upload & Processing**

* Upload PDF documents.

* Extract and store text for semantic lookup.

* Link documents to user account.

* Queries can be answered from PDFs alone or combined with API results.

**Module 4: Image Upload & Processing**

* Upload images (basic text/data extraction only).

* Process via GPT-4o/GPT-4 Vision.

* Link image content to user query context.

**Module 5: API Integration Layer (Agriculture)**

* Connect to APIs such as FEWSNET, CHIRPS, FAOSTAT, HDX.

* Normalize API responses.

* Handle errors and timeouts gracefully.

**Module 6: Search Results UI**

* Show whether the answer came from API, PDF, image, or hybrid.

* Highlight relevant PDF/image text snippets.

**Module 7: Search History**

* Store all successful queries with source tags.

* Allow deletion of individual entries.

**Module 8: User Profile**

* View and edit profile details.

* Change password securely.

* Logout.

#### **4.2 Admin Panel**

**Module 1: Admin Login**

* Secure role-based login.

**Module 2: Dashboard**

* Total registered users.

* Total queries today.

* API vs PDF vs Image query breakdown.

**Module 3: User Management**

* View and manage user accounts.

* View user’s uploaded PDFs/images.

* Activate/deactivate/delete accounts.

**Module 4: Document & Image Management**

* View, search, and manage uploaded PDFs and images.

**Module 5: Search Logs**

* Record query source (API, PDF, Image, Hybrid).

**Module 6: Settings**

* Configure OpenAI API keys.

* Configure agriculture API keys.

**Module 7: Admin Profile Update**

* Edit admin profile and change password.

### 

### **5\. Data Flow**

`[User Query / Upload PDF or Image]`

       `↓`

`[OpenAI GPT: Extract Params & Intent]`

       `↓`

`[Router → Classify to Agriculture Agent]`

       `↓`

`[Agriculture Agent → Smart Mapping to Target API or PDF/Image Context]`

       `↓`

`[Merge Results if Hybrid]`

       `↓`

`[Render in UI with Source Labels]`

       `↓`

`[Save Query, Results & Sources in History + Optional Feedback]`

### **6\. Deliverables**

* Frontend React application for the user panel.

* Admin dashboard with secure access.

* OpenAI integration for NLP processing (**Router \+ Agriculture Agent**).

* External API connector module for agriculture data.

* PDF upload & text extraction module.

* Image upload & basic interpretation module.

* Document & image search capability.

* Deployment on VPS.

## **8\. Scope Clarifications** 

* **Included in Scope**:

  * OpenAI GPT-4o/GPT-4 API for text, PDF, and basic image understanding.  
  * Route query to a **domain-specific agent** (Agriculture)

  * Assistance API for agent workflow building.

  * PDF upload & document search.

  * Basic image reading/interpretation.

* **Not Included in Scope**:

  * Advanced image generation/editing (e.g., DALL·E).

  * Real-time video analysis.

  * Complex OCR for handwritten documents.  
  * Voice input and transcription.

  * Offline mode.

