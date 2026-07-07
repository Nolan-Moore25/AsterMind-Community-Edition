// © 2026 AsterMind AI Co. – All Rights Reserved.
// Patent Pending US 63/897,713
//
// Hand-written everyday sentences for the context-based next-word predictor
// (ADR-0004 / IMPL-0004 Phase 0). Sentences are grouped by their recurring
// lead-in phrase (e.g. "can you please ___") on purpose — each group gives
// the same context multiple plausible next words, which is what makes top-k
// accuracy on this corpus a meaningful signal instead of "did it memorize
// the one sentence it saw."
window.CONTEXT_CORPUS_SENTENCES = [
    // "(i/he/we/they) want(s) to go to the ___"
    "i want to go to the store today.",
    "i want to go to the park with my dog.",
    "i want to go to the movies this weekend.",
    "i want to go to the gym before work.",
    "i want to go to the beach next summer.",
    "i want to go to the mall to find a gift.",
    "i want to go to the doctor about my cough.",
    "i want to go to the bank before it closes.",
    "i want to go to the library to return some books.",
    "i want to go to the mountains for a hike.",
    "i want to go to the city for the concert.",
    "i want to go to the office early tomorrow.",
    "he wants to go to the gym after dinner.",
    "we want to go to the beach this weekend.",
    "they want to go to the park on saturday.",

    // "can you please ___"
    "can you please close the door before you leave.",
    "can you please pass the salt.",
    "can you please help me carry this box.",
    "can you please turn down the music.",
    "can you please call me back later.",
    "can you please send the file when you get a chance.",
    "can you please check the mail today.",
    "can you please water the plants while i am away.",
    "can you please pick up the kids from school.",
    "can you please bring an umbrella just in case.",

    // "thank you for ___"
    "thank you for the gift, i love it.",
    "thank you for your help today.",
    "thank you for coming to the party.",
    "thank you for the invitation.",
    "thank you for your patience.",
    "thank you for the advice.",
    "thank you for calling me back.",
    "thank you for the ride home.",
    "thank you for dinner last night.",
    "thank you for your time.",

    // "see you ___"
    "see you later at the game.",
    "see you tomorrow morning.",
    "see you soon, i hope.",
    "see you tonight for dinner.",
    "see you next week at the meeting.",
    "see you at the party.",
    "see you around campus.",
    "see you in the morning.",
    "see you then.",
    "see you at school tomorrow.",

    // "i need to ___"
    "i need to finish my homework before dinner.",
    "i need to buy groceries after work.",
    "i need to call my mom tonight.",
    "i need to clean the house this weekend.",
    "i need to go to bed early.",
    "i need to take a break from studying.",
    "i need to wash the car tomorrow.",
    "i need to feed the cat before i leave.",
    "i need to study for the exam tonight.",
    "i need to pay the bills this week.",

    // "(i am / he is / she is / we are) going to ___"
    "i am going to the store to get milk.",
    "i am going to the gym after lunch.",
    "i am going to the beach this weekend.",
    "i am going to the doctor tomorrow.",
    "i am going to the park with my kids.",
    "he is going to the bank later.",
    "she is going to the library after school.",
    "we are going to the movies tonight.",
    "i am going to bed early tonight.",
    "i am going to school tomorrow morning.",
    "i am going to work late today.",

    // "do you want to ___"
    "do you want to come with me to the store.",
    "do you want to watch a movie tonight.",
    "do you want to get some coffee this morning.",
    "do you want to play a game with us.",
    "do you want to go for a walk later.",
    "do you want to eat lunch together.",
    "do you want to join us for dinner.",
    "do you want to try this new restaurant.",

    // "i have to ___"
    "i have to go now, i am running late.",
    "i have to finish this report by friday.",
    "i have to pick up my kids from school.",
    "i have to catch my flight in an hour.",
    "i have to study tonight for the test.",
    "i have to leave early tomorrow morning.",

    // "let's go to ___"
    "let's go to the beach this weekend.",
    "let's go to the mall after lunch.",
    "let's go to the movies tonight.",
    "let's go to the park with the kids.",
    "let's go to dinner after the show.",

    // "i love to ___"
    "i love to read books on rainy days.",
    "i love to cook dinner for my family.",
    "i love to watch movies on the weekend.",
    "i love to go hiking in the mountains.",
    "i love to play music with my friends.",

    // "please remember to ___"
    "please remember to lock the door when you leave.",
    "please remember to bring your id to the airport.",
    "please remember to call me when you land.",
    "please remember to turn off the lights.",
    "please remember to water the plants this week.",

    // "don't forget to ___"
    "don't forget to bring your umbrella today.",
    "don't forget to feed the dog before school.",
    "don't forget to close the window tonight.",
    "don't forget to submit your homework by friday.",
    "don't forget to charge your phone tonight.",

    // "can i get ___"
    "can i get a glass of water please.",
    "can i get some help with this bag.",
    "can i get your phone number.",
    "can i get a refund for this order.",
    "can i get a receipt for my purchase.",

    // "i just want to ___"
    "i just want to relax today after a long week.",
    "i just want to say thank you for everything.",
    "i just want to get some sleep tonight.",
    "i just want to finish this project before the deadline.",

    // "i am so ___"
    "i am so tired after today.",
    "i am so excited about this trip.",
    "i am so happy to see you again.",
    "i am so proud of you for finishing.",
    "i am so glad you came to the party.",

    // "it is time to ___"
    "it is time to go home now.",
    "it is time to wake up for school.",
    "it is time to get started on this project.",
    "it is time to say goodbye for now.",
    "it is time to make a decision.",

    // "we need to ___"
    "we need to talk about this later.",
    "we need to leave soon or we will be late.",
    "we need to buy groceries for the week.",
    "we need to fix this problem before tomorrow.",
    "we need to plan the trip this weekend.",

    // "how about we ___"
    "how about we meet at noon for lunch.",
    "how about we grab coffee this afternoon.",
    "how about we go to the park later.",
    "how about we watch a movie tonight.",
    "how about we take a walk after dinner.",

    // "she wants to ___"
    "she wants to learn to paint this summer.",
    "she wants to travel the world someday.",
    "she wants to buy a new car next year.",
    "she wants to start a business of her own.",
    "she wants to read more books this year.",

    // "he went to ___"
    "he went to the store after work.",
    "he went to the gym this morning.",
    "he went to work early today.",
    "he went to school on the bus.",
    "he went to the bank during lunch.",

    // "we should ___"
    "we should talk about the plan tonight.",
    "we should leave before it gets dark.",
    "we should get some rest before tomorrow.",
    "we should plan ahead for the trip.",
    "we should celebrate tonight after the game.",

    // "i think we ___"
    "i think we should go now.",
    "i think we need more time to decide.",
    "i think we made a mistake earlier.",
    "i think we should try again tomorrow.",

    // "what time is ___"
    "what time is dinner tonight.",
    "what time is the meeting tomorrow.",
    "what time is the movie this weekend.",
    "what time is your flight.",
    "what time is the game on saturday.",

    // "the weather is ___"
    "the weather is nice today.",
    "the weather is really cold this morning.",
    "the weather is getting warmer this week.",
    "the weather is perfect for a picnic.",
    "the weather is terrible right now.",

    // "can you help me ___"
    "can you help me with this problem.",
    "can you help me find my keys.",
    "can you help me carry these bags.",
    "can you help me understand this chapter.",
    "can you help me fix my computer.",

    // "i want to ___" (broader than the "go to the" group above)
    "i want to learn how to cook.",
    "i want to travel to japan someday.",
    "i want to buy a new laptop.",
    "i want to eat something sweet.",
    "i want to watch the new movie.",
    "i want to sleep in this weekend.",

    // "please let me know ___"
    "please let me know if you need anything.",
    "please let me know when you arrive.",
    "please let me know what you decide.",
    "please let me know how it goes.",

    // "i will be there ___"
    "i will be there soon.",
    "i will be there tomorrow morning.",
    "i will be there tonight around six.",
    "i will be there shortly.",

    // "have a great ___"
    "have a great day at work.",
    "have a great weekend with your family.",
    "have a great trip to the mountains.",
    "have a great time at the party.",
    "have a great night everyone.",

    // "i can't wait to ___"
    "i can't wait to see you this weekend.",
    "i can't wait to go on vacation.",
    "i can't wait to start my new job.",
    "i can't wait to try that new restaurant.",
    "i can't wait to watch the new season.",

    // "make sure to ___"
    "make sure to lock the door before bed.",
    "make sure to bring your laptop tomorrow.",
    "make sure to check your email today.",
    "make sure to save your work before closing.",
    "make sure to turn off the stove.",

    // "i should probably ___"
    "i should probably go home now.",
    "i should probably call him back.",
    "i should probably finish this tonight.",
    "i should probably rest for a while.",
    "i should probably study for the exam.",

    // "the meeting is ___"
    "the meeting is at three o'clock.",
    "the meeting is on monday morning.",
    "the meeting is scheduled for next week.",
    "the meeting is postponed until friday.",
    "the meeting is canceled for today.",

    // "my favorite part is ___"
    "my favorite part is the ending.",
    "my favorite part is when everyone laughs.",
    "my favorite part is how it all comes together.",
    "my favorite part is watching the sunset.",

    // "i am looking for ___"
    "i am looking for a new job.",
    "i am looking for some help with this.",
    "i am looking for the nearest gas station.",
    "i am looking for my keys everywhere.",

    // "can we talk about ___"
    "can we talk about the plan for tomorrow.",
    "can we talk about what happened yesterday.",
    "can we talk about how this works.",
    "can we talk about your project timeline.",

    // "i really appreciate ___"
    "i really appreciate your help today.",
    "i really appreciate the gift you gave me.",
    "i really appreciate you being here.",
    "i really appreciate everything you have done.",

    // "we are planning to ___"
    "we are planning to visit my parents next month.",
    "we are planning to move to a new city.",
    "we are planning to build a new house.",
    "we are planning to launch the product in june.",
    "we are planning to travel across europe.",

    // "i hope you ___"
    "i hope you feel better soon.",
    "i hope you have a great trip.",
    "i hope you enjoy the party tonight.",
    "i hope you like the gift.",
];
