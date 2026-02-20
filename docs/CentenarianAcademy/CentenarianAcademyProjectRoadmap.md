# **Centenarian Athlete Academy: Technical Roadmap**

## **1\. Feature Breakdown**

### **A. Gated Video Ecosystem**

* **Mechanism:** Signed URLs with 60-minute expiration.  
* **Hierarchical Access:** A single SQL function checks if a user has access via individual video, chapter, section, or global "Paid" status.  
* **Free Openers:** The first video of every chapter is public to serve as a lead magnet.

### **B. "Choose Your Own Adventure" (CYOA) Engine**

* **The Crossroads:** A UI component triggered on video\_ended.  
* **Recommendation Logic:**  
  * 1 Linear Next Step (Chapter Order).  
  * 2 Semantic Neighbors (Vector Similarity via Gemini).  
  * 1 Random Node (The Unknown Path).  
  * 1 Full Map Access.

### **C. Unified Study Assets**

* **Assets:** Transcripts, Flashcards, Study Guides.  
* **Gating:** Assets inherit the permission of their parent video.  
* **Tracking:** Every download and "Reader View" scroll is logged as a "Depth of Study" metric.

### **D. Behavioral Telemetry**

* **Intent-Aware Logging:** We log the *source* and *destination* of every navigation choice to identify which "Adventure Paths" lead to the highest completion rates.

## **2\. Implementation Milestones**

1. **Security Handshake:** Cloudinary \+ Supabase \+ Stripe.  
2. **AI Indexing:** Bulk processing of all NASM transcripts.  
3. **Core Adventure Loop:** Video \-\> Crossroads \-\> Next Video.  
4. **Admin/User Dashboards.**