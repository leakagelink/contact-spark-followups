# Contact Spark Followups

# Build a Production-Ready AI Contact Importer & WhatsApp Follow-up App

Act as a senior full-stack engineer, mobile application architect, AI/OCR engineer, UI/UX designer, and database architect.

Build a complete, responsive, production-oriented application that can extract contact information from images, scanned documents, PDFs, Excel files, Word documents, and pasted text. The application must convert the extracted information into structured contacts that users can review, import, call, and follow up with through WhatsApp.

Do not build only a landing page or static UI. Implement functional workflows, database integration, validation, import processing, error handling, and mobile-friendly interactions.

## 1. Product Objective

Create an app named "ContactFlow AI" (keep the name configurable).

Primary value proposition:

"Extract contacts from any document. Import them in seconds. Call and follow up on WhatsApp."

The app should work as a personal contact manager and lightweight sales/contact follow-up CRM.

## 2. Dashboard

Create a modern dashboard showing:

- Total contacts
- Contacts imported today
- Contacts with mobile numbers
- Contacts with email addresses
- Contacts with WhatsApp numbers
- Contacts awaiting follow-up
- Recent import history
- Recent calls and follow-up activity

Provide prominent action buttons:

1. Import File
2. Scan Document
3. Paste Text
4. Add Contact Manually
5. View All Contacts

Display recent contacts in a clean list with name, phone number, email, import source, and quick actions.

## 3. Multi-Format Contact Import

Implement a unified import system supporting:

### Image Import
- JPG, JPEG, PNG, and WEBP
- Visiting cards and business cards
- Screenshots containing contact information
- Photographs of printed lists
- Handwritten information where OCR confidence permits
- Multiple images in one import session

### PDF Import
- Text-based PDFs
- Scanned PDFs using OCR
- Multi-page PDF documents
- Extract contacts across all pages
- Preserve page number and source filename when available

### Excel and CSV Import
- XLSX, XLS, and CSV
- Read multiple worksheets
- Detect column headers automatically
- Map columns such as Name, Mobile, Phone, WhatsApp, Email, Address, Company and Notes
- Support different column names and layouts
- Allow users to select worksheets and preview rows before importing

### Word Documents
- DOCX and DOC
- Extract structured and unstructured contact details
- Support tables, lists, and paragraphs
- Handle unsupported legacy DOC files gracefully, with a clear conversion instruction

### Paste Text
Provide a large text area where users can paste:
- Copied website content
- WhatsApp messages
- Email signatures
- Contact lists
- Business directories
- Plain text containing multiple people

Example input:

Rahul Sharma, +91 9876543210, rahul@example.com, Indore
Priya Verma, 9123456780, priya@example.com, Bhopal

The extraction engine must identify separate people and create one structured record per person.

Include a Paste from Clipboard button where browser permissions allow it, while always supporting manual paste.

### Bulk Import
Allow users to select multiple supported files and process them in one import session.

Show processing progress, successful records, duplicates, failed records, and records requiring manual review.

## 4. AI-Powered Contact Extraction

Extract as many relevant fields as are actually present in the source.

Contact schema:

- Full name
- First name
- Last name
- Primary mobile number
- Secondary mobile number
- WhatsApp number, if explicitly provided or confirmed by the user
- Email address
- Secondary email
- Full address
- City
- State
- Country
- Postal code
- Company name
- Job title
- Website
- Notes
- Source filename
- Source page or worksheet, when available
- Import date
- Extraction confidence
- Verification status

Requirements:

- Identify multiple contacts in one document.
- Handle Indian mobile numbers and international phone formats.
- Normalize phone numbers using country-aware parsing.
- Never invent missing names, numbers, emails, or addresses.
- Preserve original extracted values for review.
- Distinguish mobile numbers from landline numbers when possible.
- Flag ambiguous fields and low-confidence extraction.
- Support partial contacts even when some fields are missing.
- Extract emails, phone numbers, and addresses using a combination of OCR, deterministic parsing, and AI.
- Use structured JSON output validated against a defined schema.
- Retry or gracefully handle invalid AI output.
- Make the extraction provider configurable.
- Never expose secret API keys in frontend code.

Use OCR for text recognition and an AI extraction layer for understanding the recognized text. Do not rely on an LLM alone for basic phone and email pattern detection.

## 5. Scan Using Camera

Provide a mobile-first document scanner.

Features:
- Capture a document or visiting card using the device camera.
- Upload existing images from the gallery.
- Crop and rotate images.
- Correct perspective where supported.
- Improve contrast and readability.
- Preview the image before processing.
- Extract text using OCR.
- Display extracted contacts for review.
- Allow multiple pages or images in a single session.

For mobile web, use supported browser camera capabilities. For a native Android application, use an appropriate Capacitor-compatible camera/scanner implementation.

Do not simulate camera scanning if the actual capability is unavailable.

## 6. Review Before Import

After extraction, show a dedicated review screen.

Display each detected contact in an editable form or table.

Allow users to:
- Edit extracted fields
- Delete incorrect records
- Select individual contacts
- Select all contacts
- Import selected contacts
- Import all valid contacts
- Return to the original source when possible
- Review low-confidence fields
- Fix invalid phone numbers and emails
- Cancel the import

Show validation indicators for:
- Valid phone number
- Invalid or incomplete phone number
- Valid email
- Missing name
- Duplicate contact
- Low-confidence extraction

Never silently import questionable or malformed records without indicating their status.

## 7. Contact Management

Create a searchable contact database with:

- Search by name, phone, email, company, and city
- Filters for source, import date, and follow-up status
- Sorting by name, newest, oldest, and last contacted
- Individual contact detail pages
- Edit and delete actions
- Bulk delete with confirmation
- Tags and categories
- Notes and follow-up reminders
- Import source tracking
- Contact activity history

Support pagination or efficient virtualized lists for large contact databases.

## 8. Duplicate Detection

Prevent duplicate records during imports.

Use normalized phone numbers and email addresses as primary matching signals.

Also provide:
- Potential duplicate detection by name
- Duplicate warnings during preview
- Merge contacts functionality
- Side-by-side comparison of duplicate records
- A choice to skip, update, or merge existing contacts

Do not merge records automatically when identity is ambiguous.

Preserve existing data when importing updated contact details.

## 9. Calling Functionality

Every contact with a valid phone number must have a prominent Call button.

Requirements:
- Use the device's native dialer through a supported tel: link or native integration.
- Do not automatically place calls without explicit user action.
- Track the selected contact and number before opening the dialer.
- Record a call initiation event with the contact ID, phone number, and timestamp.
- Do not claim a call was completed simply because the dialer opened.

### Return From Call: WhatsApp Follow-up

This is a critical feature.

When a user initiates a call from the app and later returns to the app, show a contextual follow-up prompt for the same contact and number:

"Call follow-up"

Contact: Rahul Sharma
Number: +91 9876543210

Actions:
- Share Details on WhatsApp
- Skip WhatsApp

Expected workflow:
1. User taps Call.
2. App saves a pending follow-up context for that contact and number.
3. App opens the device dialer.
4. When the app becomes active again, it checks whether a valid pending call context exists.
5. If the context is still valid and has not already been handled, display the follow-up prompt.
6. The user can open WhatsApp with a prepared message or dismiss the prompt.
7. Mark the prompt as handled when the user chooses an action.

Important technical requirements:
- Implement app lifecycle handling using Capacitor's supported app state events or an appropriate native Android integration.
- Do not assume that a browser visibility event proves the call ended.
- Do not claim that the app can reliably detect call completion unless the implementation actually supports it.
- Where native call-state detection is unavailable or restricted, use a clearly labelled return-from-dialer follow-up prompt as a fallback.
- Prevent stale prompts from appearing long after the call.
- Prevent the same prompt from appearing repeatedly.
- Provide a manual follow-up action if lifecycle detection fails.
- Do not request call-log or phone-state permissions unless genuinely necessary and permitted by current platform policies.
- The feature must not require call recording or access to call audio.

## 10. WhatsApp Messaging

Every contact with a valid phone number must have a WhatsApp action.

Implement:
- Individual WhatsApp message
- Individual contact detail sharing
- Multi-select contacts for bulk sharing
- Select all valid contacts
- Deselect individual contacts
- Message template selection
- Custom message composition
- Preview before opening WhatsApp
- Follow-up status tracking

Suggested default message:

"Hello {{name}}, this is a follow-up regarding our recent call. Please let me know a convenient time to connect. Thank you."

Support placeholders such as:
- {{name}}
- {{phone}}
- {{company}}

Use the WhatsApp Click to Chat URL format with properly URL-encoded message text and a normalized international phone number.

If WhatsApp is unavailable or the number is invalid, display a helpful error or alternative.

### Bulk WhatsApp Sharing

When multiple contacts are selected:
- Display the selected count.
- Allow users to prepare a message.
- Process contacts individually.
- Open the appropriate WhatsApp conversation for each contact through a user-initiated action.
- Maintain a clear queue showing pending, opened, skipped, and failed items.
- Require the user to proceed between recipients.
- Never claim a message was sent merely because WhatsApp opened.
- Do not automate mass messaging, bypass WhatsApp restrictions, or send messages without user confirmation.

For sharing a contact's details, prepare a message containing the selected fields, for example:

Name: Rahul Sharma
Phone: +91 9876543210
Email: rahul@example.com
Address: Indore, Madhya Pradesh

Only include fields that are present and selected by the user.

## 11. Export Functionality

Allow users to export selected or all contacts as:

- Excel XLSX
- CSV
- vCard VCF

Optionally support PDF reports containing contact lists.

Include field selection for exports and ensure Indian phone numbers are not accidentally converted into scientific notation or stripped of leading zeros.

## 12. Database and Backend

Use Supabase with PostgreSQL for persistent storage.

Suggested tables:

### profiles
- id
- display_name
- created_at

### contacts
- id
- user_id
- full_name
- first_name
- last_name
- phone
- secondary_phone
- whatsapp_phone
- email
- secondary_email
- address
- city
- state
- country
- postal_code
- company
- job_title
- website
- notes
- tags
- source_filename
- source_type
- verification_status
- created_at
- updated_at
- last_contacted_at

### import_jobs
- id
- user_id
- source_type
- source_filename
- status
- total_records
- successful_records
- duplicate_records
- failed_records
- created_at
- completed_at

### import_records
- id
- import_job_id
- extracted_data
- confidence
- validation_errors
- source_location
- status

### contact_activities
- id
- user_id
- contact_id
- activity_type
- phone_number
- status
- metadata
- created_at

### follow_up_tasks
- id
- user_id
- contact_id
- activity_id
- status
- message_template
- created_at
- completed_at

Adapt the schema where necessary for proper relational integrity, indexing, and maintainability.

Security requirements:
- Enable Row Level Security on every user-owned table.
- Users must only access their own contacts, imports, and activity records.
- Use authenticated backend functions for protected operations.
- Keep AI and other private API keys in server-side secrets.
- Validate uploaded file types, sizes, and contents.
- Restrict file access and use private storage buckets.
- Avoid retaining original files longer than necessary.
- Provide secure account deletion and data export.
- Never expose contact data publicly.

Use migrations and database constraints for important invariants.

## 13. Recommended Architecture

Build the web application using:
- React
- TypeScript
- Vite
- Tailwind CSS
- A consistent component library
- Supabase Auth
- Supabase PostgreSQL
- Supabase Edge Functions or another secure backend for AI requests
- A suitable OCR provider or OCR engine
- Reliable PDF, Excel, CSV, and DOCX parsing libraries

For Android calling and app-return lifecycle behavior:
- Use Capacitor for native packaging and native capabilities.
- Implement native integrations only where supported.
- Keep the core application usable in a browser.
- Document any functionality that requires a native Android build.
- Do not claim a browser-only implementation provides native call-state access.

Keep the architecture modular, with separate services for:
- File processing
- OCR
- Contact extraction
- Validation
- Duplicate detection
- Contact persistence
- Calling
- WhatsApp URL generation
- Activity tracking
- Export generation

## 14. UI/UX Design

Design a polished, modern CRM-style interface.

Style:
- Clean white or neutral background
- Deep navy typography
- Teal or blue accent color
- Rounded cards
- Subtle borders and shadows
- Clear visual hierarchy
- Professional dashboard
- Responsive mobile layout
- Accessible buttons and readable forms

Desktop navigation:
- Dashboard
- All Contacts
- Import Center
- Scan Document
- Follow-ups
- Import History
- Settings

Mobile navigation:
- Home
- Contacts
- Import
- Follow-ups
- Settings

Use clear icons and large touch targets.

Include loading states, empty states, error messages, success feedback, confirmation dialogs, and accessible keyboard navigation.

Avoid clutter and excessive animations.

## 15. Import Processing UX

Create a step-based import workflow:

Step 1: Choose source
Step 2: Upload, scan, or paste
Step 3: Extract information
Step 4: Validate and detect duplicates
Step 5: Review and edit
Step 6: Confirm import
Step 7: Show import summary

Example summary:

- 120 contacts detected
- 105 valid contacts
- 8 potential duplicates
- 5 records requiring review
- 2 records failed validation

These are illustrative examples only. Display actual processing results in the application.

## 16. Testing and Acceptance Criteria

Implement and test the following scenarios:

1. Import an image containing several contacts.
2. Extract contacts from a scanned PDF.
3. Import an Excel workbook with multiple sheets.
4. Parse a Word document containing contact details.
5. Paste unstructured text containing multiple people.
6. Correct low-confidence fields before import.
7. Detect duplicate phone numbers and emails.
8. Import selected contacts without importing the rest.
9. Call a contact through the device dialer.
10. Return to the app and show the correct follow-up prompt when supported.
11. Skip WhatsApp and ensure the prompt is not repeated.
12. Open a prefilled WhatsApp message for an individual contact.
13. Select multiple contacts and process them one at a time.
14. Export contacts to Excel and CSV.
15. Verify that users cannot access another user's data.
16. Verify that missing API keys or failed OCR requests produce helpful errors.
17. Verify that large imports do not freeze the interface.

Do not mark any test as passed unless it has actually been tested.

## 17. Development Execution Instructions

Start by creating the complete application shell, database schema, authentication, contact management, and responsive UI.

Then implement the import pipeline, OCR, AI extraction, validation, duplicate handling, calling, WhatsApp follow-up, and exports in separate testable modules.

Use real database operations rather than local mock data for core workflows. If any external service is not configured, provide a clear configuration requirement and an honest development fallback.

Do not hardcode fake extraction results or simulated successful imports.

Do not stop after creating the dashboard. Complete the functional workflows and explain which features require API keys, deployment configuration, or a native Android build.

At the end, provide:
- Implemented feature checklist
- Database schema and security policies
- Required environment variables
- AI/OCR provider setup
- Native Android integration requirements
- Known limitations
- Testing instructions
- Deployment instructions

Prioritize data accuracy, user privacy, reliable imports, and a smooth contact-to-call-to-WhatsApp workflow.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://contact-spark-followups.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/19ce6bd0-bd08-4205-93ef-109ec7d36ecd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
