# DMT FOH Shift Guide V4.1.0

This release preserves the POW data and adds confirmed PET whole-role assessments, a refreshed dashboard and searchable briefing answers.

PET has 32 positions: 30 original position sheets plus two clearly labelled agreed kiosk role summaries. Wheelchair totals are 11 Green, 1 Amber and 20 Red. Walking stick/rollator totals are 11 Green, 7 Amber and 14 Red. Green means the core role is accessible with the stated arrangements. Reassigned duties are displayed Amber while original physical restrictions remain in the source data. The user’s agreed PEEP replaces standard evacuation and clearance responsibilities. Grand Circle core roles remain Red. Interval Orders/Foyer Seller retains its existing rating because a new Green assessment was not agreed.

The offline briefing guide contains exactly 105 supplied questions and answers from PET Breifing ANSWERS.docx. Search reads both questions and answers. On-shift lookup opens matching answers; briefing quiz keeps them closed until tapped. Original wording is retained. Separate notes clarify specific source limitations without changing answers.

Quick Reference includes confirmed PET radio codes, three muster points, walking-directions links and Stage Door telephone/extension. Maps require internet and are not approved step-free evacuation routes. Remaining telephone collection prompts and general reference feedback save on the device.

Instruction feedback remains under the existing dmt-feedback-v4 storage key. Briefing questions and answers are read-only and have no feedback or editing controls. Share opens the phone share sheet where supported; Download provides a text file. Nothing is emailed or uploaded automatically.

The authoritative release workbook is PET Accessibility Master v6.xlsx, stored locally outside the public app. Never publish workbooks, personal feedback exports, private medical information or local QA files to the repository.

Deploy the app root files and data/master-data.js plus data/master-data.json together. Preview/test HTML files are local-only. The versioned service worker caches the full app and briefing data. Existing users are offered an update before activation.

PET photograph: Adrian Pingstone, 2005, public domain. https://commons.wikimedia.org/wiki/File:Prince_Edward_Theatre_2005_-_Mary_Poppins.jpg
