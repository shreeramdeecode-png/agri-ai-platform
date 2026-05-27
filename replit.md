# AgriSearch - AI-Powered Agriculture Search Platform

## Overview

AgriSearch is a full-stack web application that provides natural language search capabilities for agriculture, climate, and market data. The platform leverages Google Gemini to interpret user queries, route them through a domain-specific agent system, and fetch results from external APIs and uploaded documents. Users can upload PDF documents and images for AI-powered analysis, while administrators manage the platform through a secure admin panel.

The application serves two primary user types:
- **End Users**: Access natural language search, document/image uploads, and query history
- **Administrators**: Manage users, view system logs, configure API settings, and monitor platform usage

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Application Structure

**Monorepo Architecture**: The project uses a monorepo structure with clear separation of concerns:
- `/client`: React frontend built with Vite
- `/server`: Express.js backend with TypeScript
- `/shared`: Shared schema definitions and types accessible to both frontend and backend
- `/uploads`: File storage directory for user-uploaded PDFs and images

**Technology Stack**:
- Frontend: React + Vite + Tailwind CSS + shadcn/ui components
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL (via Neon serverless)
- ORM: Drizzle ORM
- AI Integration: OpenAI GPT-4o and GPT-4 Vision APIs
- Authentication: JWT-based with bcrypt password hashing
- File Processing: Multer for uploads, pdf-parse for PDF text extraction

### Database Schema

The application uses PostgreSQL with Drizzle ORM, defining seven core tables:

1. **users**: Stores user accounts with role-based access (admin/user), email authentication, and account status
2. **documents**: Tracks uploaded PDF files with extracted text content for search
3. **images**: Stores uploaded images with AI-extracted data/metadata
4. **search_history**: Logs all search queries with parameters, results, source type, and execution metrics
5. **api_settings**: Configurable key-value store for API keys and system settings
6. **admin_logs**: Audit trail of administrative actions for compliance and monitoring

**Design Decision**: UUID primary keys are used via PostgreSQL's `gen_random_uuid()` function for better scalability and security compared to auto-incrementing integers.

### Authentication & Authorization

**JWT-based Authentication**: 
- Token generation on login/signup with 7-day expiration
- Middleware-based route protection (authMiddleware, adminMiddleware)
- Role-based access control separating admin and user capabilities
- Secure password storage using bcrypt hashing

**Rationale**: JWT provides stateless authentication suitable for API-driven architectures, reducing database lookups on every request. The 7-day token expiration balances security with user convenience.

### AI Agent System

**Router + Domain Agent Pattern**:
The application implements a scalable agent architecture designed for future expansion:

1. **Query Intent Extraction**: OpenAI GPT-4o analyzes natural language queries to extract structured parameters (crop type, country, region, date range)
2. **Domain Classification**: Router determines which domain agent to use (currently only Agriculture agent is active)
3. **Agriculture Agent**: Maps extracted parameters to appropriate external agriculture/climate APIs
4. **Response Generation**: Combines API results with GPT-generated natural language explanations

**Search Source Hierarchy**:
- External APIs (FEWSNET, CHIRPS, FAO) for real-time agriculture data
- Uploaded PDF documents for user-specific knowledge
- Uploaded images analyzed via GPT-4 Vision for visual data extraction

**Design Rationale**: The router pattern allows easy addition of new domain agents (e.g., healthcare, finance) without modifying core search logic. Each agent encapsulates domain-specific API mappings and knowledge.

### File Processing Pipeline

**PDF Processing**:
1. Upload via Multer with 10MB file size limit
2. Server-side text extraction using pdf-parse library
3. Text storage in database for semantic search
4. Physical file storage in `/uploads` directory

**Image Processing**:
1. Upload with validation (JPEG, JPG, PNG only)
2. OpenAI GPT-4 Vision API call for content analysis
3. Extracted metadata/text stored in database
4. Physical file retention for future re-analysis

**Rationale**: Extracting and storing text/metadata enables fast search without repeated API calls or file parsing. File size limits prevent resource exhaustion.

### Frontend Architecture

**Component-Based Design**:
- Shared UI components via shadcn/ui (buttons, cards, forms, dialogs)
- Layout components (AdminLayout, UserLayout) for consistent navigation
- Page components for each route (search, documents, images, admin panels)

**State Management**:
- TanStack Query (React Query) for server state management and caching
- Local state for form inputs and UI interactions
- LocalStorage for JWT token and user profile persistence

**Routing**:
- Wouter for lightweight client-side routing
- Protected route wrappers for authentication checks
- Separate route hierarchies for admin and user interfaces

**Design Decision**: TanStack Query eliminates need for Redux/context for server state, automatically handling caching, refetching, and loading states. Wouter provides routing with minimal bundle size impact.

### API Design

**RESTful Endpoints**:
- `/api/auth/*`: Authentication (signup, login)
- `/api/search/*`: Search queries and history
- `/api/documents/*`: PDF upload, list, delete
- `/api/images/*`: Image upload, list, delete
- `/api/user/*`: User profile management
- `/api/admin/*`: Administrative operations (users, logs, settings, dashboard)

**Middleware Stack**:
1. Express JSON/URL-encoded body parsing
2. Request logging with timing
3. JWT authentication middleware (where required)
4. Role-based authorization middleware (admin routes)
5. Error handling middleware

**Design Rationale**: RESTful design provides intuitive, predictable API structure. Middleware layering ensures cross-cutting concerns (auth, logging) are handled consistently.

## External Dependencies

### Third-Party Services

**OpenAI API**: 
- GPT-4o for natural language understanding and response generation
- GPT-4 Vision for image content analysis
- Required API key stored in environment variables

**Agriculture/Climate APIs** (Placeholder implementations ready for real endpoints):
- FEWSNET: Food security and famine early warning data
- CHIRPS: Climate and precipitation data
- FAO: Food and Agriculture Organization datasets

### Database

**Neon Serverless PostgreSQL**:
- Serverless PostgreSQL with WebSocket support for edge deployment
- Connection pooling via @neondatabase/serverless
- DATABASE_URL environment variable for connection string

**Rationale**: Neon provides PostgreSQL compatibility with serverless scaling, ideal for Replit deployment. WebSocket support enables connections from serverless/edge environments.

### Key NPM Packages

**Backend**:
- `express`: Web server framework
- `drizzle-orm`: Type-safe ORM for PostgreSQL
- `jsonwebtoken`: JWT creation and validation
- `bcryptjs`: Password hashing
- `multer`: Multipart form data (file uploads)
- `pdf-parse`: PDF text extraction
- `axios`: HTTP client for external API calls

**Frontend**:
- `react` + `react-dom`: UI library
- `@tanstack/react-query`: Server state management
- `wouter`: Lightweight routing
- `@radix-ui/*`: Headless UI primitives for shadcn/ui
- `tailwindcss`: Utility-first CSS framework

**Development**:
- `vite`: Build tool and dev server
- `typescript`: Type safety
- `drizzle-kit`: Database migrations
- `tsx`: TypeScript execution for Node.js

### Environment Configuration

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT signing (security critical)
- `OPENAI_API_KEY`: OpenAI API authentication
- `NODE_ENV`: Environment indicator (development/production)
- `PORT`: Server port (defaults to 3000)