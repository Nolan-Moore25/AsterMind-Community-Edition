// © 2026 AsterMind AI Co. – All Rights Reserved.
// Patent Pending US 63/897,713
//
// The bundled dataset (AbdulHadi806/mail_spam_ham_dataset) is, despite its name,
// the classic 2011-era UK SMS Spam Collection — short text messages, not email.
// Words like "verify", "suspended", "identity", "nigerian", "viagra" appear in
// zero of its 5613 rows, so a model trained on it alone never learns modern
// phishing / advance-fee-fraud / pharma-spam vocabulary, and misclassifies
// exactly that kind of message (confirmed: a "verify your identity or your
// account will be suspended" phishing email scored as 62% ham).
//
// This is a small hand-written patch — 30 modern "ham" (legitimate transactional
// email) and 30 "spam" (phishing/scam email) examples — merged into the training
// data in main.js so the model actually sees this vocabulary.
window.EMAIL_AUGMENT_EXAMPLES = [
    // ---- ham: legitimate transactional / notification email ----
    { text: "Subject: Dentist appointment reminder. This is a reminder of your appointment on July 2 at 10:00 AM. Reply C to confirm or call us to reschedule.", label: 'ham' },
    { text: "Subject: Doctor appointment confirmation. Your appointment with Dr. Patel is confirmed for Thursday at 3:30 PM. Please arrive 10 minutes early.", label: 'ham' },
    { text: "Subject: Your order has shipped. Your order #48213 shipped today and should arrive by Friday. Track it with number 1Z999AA10123456784.", label: 'ham' },
    { text: "Subject: Order confirmation. Thanks for your order! We've charged $42.50 to your card ending in 4321. Your receipt is attached.", label: 'ham' },
    { text: "Subject: Password changed successfully. Your account password was changed on June 24 at 9:14 AM. If this wasn't you, contact support from the app.", label: 'ham' },
    { text: "Subject: Meeting invite: Sprint planning. You're invited to Sprint Planning on Monday at 9:00 AM in the main conference room. Let me know if that time doesn't work.", label: 'ham' },
    { text: "Subject: Your electric bill is due soon. Your statement balance of $86.40 is due on July 5. Log in to your account to view your bill.", label: 'ham' },
    { text: "Subject: Your subscription renews next week. Your annual plan renews on July 1 for $89.99. No action is needed if you'd like to continue.", label: 'ham' },
    { text: "Subject: New statement available. Your June statement is now available in online banking. No action is required.", label: 'ham' },
    { text: "Subject: Flight confirmation. Your flight to Chicago on July 10 is confirmed. Check-in opens 24 hours before departure.", label: 'ham' },
    { text: "Subject: Interview confirmation. We're confirming your interview for Tuesday at 1:00 PM with the engineering team. Please bring a copy of your resume.", label: 'ham' },
    { text: "Subject: Library book due soon. Your book 'Clean Code' is due back on June 28. Renew online to avoid a late fee.", label: 'ham' },
    { text: "Subject: Parent-teacher conference reminder. Your conference is scheduled for Wednesday at 4:15 PM in Room 204.", label: 'ham' },
    { text: "Subject: Gym membership renewal. Your monthly membership renews on July 1 for $35. Visit the front desk if you have questions.", label: 'ham' },
    { text: "Subject: Car service reminder. Your vehicle is due for an oil change. Schedule your appointment online or call the shop.", label: 'ham' },
    { text: "Subject: Webinar registration confirmed. You're registered for Thursday's webinar on accessible web design. A calendar invite is attached.", label: 'ham' },
    { text: "Subject: App update available. Version 4.2 includes bug fixes and performance improvements. Update from the app store at your convenience.", label: 'ham' },
    { text: "Subject: Monthly product newsletter. Here's what shipped this month: dark mode, faster search, and a new mobile layout.", label: 'ham' },
    { text: "Subject: Conference registration confirmed. Your badge for the August developer conference is ready. Pick it up at registration.", label: 'ham' },
    { text: "Subject: Package out for delivery. Your package is out for delivery and should arrive by 8 PM today.", label: 'ham' },
    { text: "Subject: Insurance policy renewal notice. Your auto policy renews on August 1. Your premium will stay the same as last term.", label: 'ham' },
    { text: "Subject: Salon appointment reminder. Your haircut appointment is tomorrow at 11:00 AM with Jamie. Reply to confirm.", label: 'ham' },
    { text: "Subject: Reservation confirmed. Your table for two is booked for Saturday at 7:00 PM. We'll hold it for 15 minutes.", label: 'ham' },
    { text: "Subject: Course enrollment confirmed. You're enrolled in Intro to Data Structures starting Monday. Course materials are linked below.", label: 'ham' },
    { text: "Subject: Scheduled maintenance notice. Power will be briefly interrupted in your area on Sunday between 1 and 3 AM for maintenance.", label: 'ham' },
    { text: "Subject: Volunteer event reminder. Thanks for signing up for Saturday's park cleanup. Meet at the main pavilion at 9 AM.", label: 'ham' },
    { text: "Subject: Benefits enrollment closes Friday. Open enrollment for health benefits closes this Friday. Log in to review your options.", label: 'ham' },
    { text: "Subject: Quick feedback request. How did we do on your recent support ticket? It only takes a minute to answer.", label: 'ham' },
    { text: "Subject: Standup reminder. Daily standup starts in 10 minutes in the usual room.", label: 'ham' },
    { text: "Subject: Thank you for your donation. Your $50 donation to the food bank was received. A receipt for tax purposes is attached.", label: 'ham' },

    // ---- spam: phishing / advance-fee fraud / scam email ----
    { text: "Subject: Re: Your account. Dear customer, we detected unusual activity. Verify your identity immediately at http://secure-login-verify.xyz or your account will be suspended.", label: 'spam' },
    { text: "Subject: Business proposal. I am a Nigerian prince seeking to transfer $25 million. I need your bank details to share 30% with you.", label: 'spam' },
    { text: "Subject: You've won! Congratulations, you've won our weekly lottery prize of $1,000,000! Claim now by replying with your full name and address.", label: 'spam' },
    { text: "Subject: CHEAP MEDS. Buy V1agra and Cial1s at 90% discount. Discreet shipping worldwide. Order now no prescription required.", label: 'spam' },
    { text: "Subject: Hot singles in your area. Lonely tonight? Meet beautiful women now. No credit card needed. Sign up free!!!", label: 'spam' },
    { text: "Subject: Virus detected on your computer. Our scan found 5 viruses on your device. Call this number immediately to remove them before data loss.", label: 'spam' },
    { text: "Subject: Double your bitcoin today. Send 0.1 BTC and receive 0.2 BTC back within 24 hours guaranteed. Limited time offer.", label: 'spam' },
    { text: "Subject: An urgent message from a dying soldier. I have $4.5 million inheritance and no family. Help me transfer it and keep half for yourself.", label: 'spam' },
    { text: "Subject: Invoice overdue, pay immediately. Your invoice #88213 is overdue. Pay now via the link below to avoid legal action.", label: 'spam' },
    { text: "Subject: Earn $5000 a week from home. No experience needed. Just send your bank details to get started with our work from home program today.", label: 'spam' },
    { text: "Subject: Suspicious login detected. We noticed a login from a new device. Confirm your identity now or your account will be locked.", label: 'spam' },
    { text: "Subject: Tax refund pending. You are owed a tax refund of $850. Click here and enter your social security number to claim it.", label: 'spam' },
    { text: "Subject: Customs fee required for your package. Your package is being held. Pay a small customs fee now to release your delivery.", label: 'spam' },
    { text: "Subject: Urgent request from the CEO. I need you to purchase five $200 gift cards right away and send me the codes. Keep this confidential.", label: 'spam' },
    { text: "Subject: Free $500 gift card waiting for you. You've been selected to receive a free gift card. Click now before it expires.", label: 'spam' },
    { text: "Subject: Cheap software keys, 95% off. Get Windows and Office activation keys for $9.99. Instant delivery, no questions asked.", label: 'spam' },
    { text: "Subject: Lose 30 pounds in 2 weeks guaranteed. This miracle pill melts fat overnight with no diet or exercise. Order now while supplies last.", label: 'spam' },
    { text: "Subject: Guaranteed loan approval, bad credit ok. Get approved for $10,000 today no credit check. Apply now and get cash fast.", label: 'spam' },
    { text: "Subject: Unclaimed inheritance notice. A distant relative left you an unclaimed inheritance of $2 million. Reply with your details to begin the claim.", label: 'spam' },
    { text: "Subject: Free crypto airdrop, claim now. Connect your wallet now to claim 500 free tokens before the airdrop ends tonight.", label: 'spam' },
    { text: "Subject: Your social media account was compromised. Someone tried to log into your account from another country. Verify your password now.", label: 'spam' },
    { text: "Subject: Your Netflix payment failed. Update your payment details immediately or your subscription will be cancelled today.", label: 'spam' },
    { text: "Subject: We have your private photos. Pay $500 in bitcoin within 24 hours or we send these to all your contacts.", label: 'spam' },
    { text: "Subject: Urgent disaster relief needed. Donate now to help victims of the flood, all funds go directly to families in need, wire transfer preferred.", label: 'spam' },
    { text: "Subject: Work from home, earn big, pay for kit first. Get hired today, just pay a small fee for your starter kit to begin earning immediately.", label: 'spam' },
    { text: "Subject: You qualify for a reward. Complete this short survey and claim your $100 reward card instantly.", label: 'spam' },
    { text: "Subject: Live cam girls waiting for you. Click here for free access, no card required, sign up in seconds.", label: 'spam' },
    { text: "Subject: Your parcel could not be delivered. Pay a small redelivery fee online now or your parcel will be returned.", label: 'spam' },
    { text: "Subject: Luxury watches 80% off today only. Replica designer watches at unbeatable prices, order now before this deal ends.", label: 'spam' },
    { text: "Subject: Join our investment club, guaranteed returns. Members are earning 40% monthly returns. Limited spots available, join now.", label: 'spam' }
];
