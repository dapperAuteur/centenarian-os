# **Step-by-Step Build Guide: Centenarian Athlete Academy**

Follow these steps exactly to build the standalone Next.js environment.

## **Phase 1: Infrastructure (Completed)**

* **Step 1:** Terminal Initialization & Dependencies.  
* **Step 2:** Environment Configuration (.env.local).  
* **Step 3:** Supabase Database Setup (setup\_schema.sql).  
* **Step 4:** Core Utility Implementation (lib/ directory).

## **Phase 2: Security & Monetization (Next)**

* **Step 5: Secure Video Server Action:** Implement the "Security Guard" to prevent premium video leakage using Cloudinary Signed URLs.  
* **Step 6: Stripe Integration:** Create the $100 checkout flow and the secure webhook handler to toggle the is\_paid status.

## **Phase 3: AI & Semantic Intelligence**

* **Step 7: Gemini Embedding Pipeline:** Create the Server Action to process transcripts into 1536-dimension vectors.  
* **Step 8: Semantic Recommendation Engine:** Implement the logic that queries pgvector for related content.

## **Phase 4: The Adventure UI (UX)**

* **Step 9: The Video Player Shell:** A custom player that handles gating, progress tracking, and event listening.  
* **Step 10: The Crossroads:** The 5-choice post-video navigation UI (Next, Related A/B, Random, Menu).  
* **Step 11: The Transcript Reader:** On-page reader with keyword search and timestamp jumping.

## **Phase 5: Dashboards & Telemetry**

* **Step 12: The Logbook (User):** A visual "Trail Map" showing progress through the NASM curriculum.  
* **Step 13: Admin Command Center:** Content management, user permission overrides, and behavioral log analysis.  
* **Step 14: Final Polish & Deployment:** Vercel deployment and production RLS verification.  
* 