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
    // v2 additions — deliberately widen the "go to the ___" p/m clusters
    // (park/playground/plaza/party/pool and movies/mall/mountains/market/museum)
    // so the active-typing prefix demo (ADR-0005) has real width to filter.
    "i want to go to the playground with my kids.",
    "i want to go to the plaza for lunch.",
    "i want to go to the party tonight.",
    "i want to go to the pool this afternoon.",
    "i want to go to the market for vegetables.",
    "i want to go to the museum this weekend.",
    "she wants to go to the playground after school.",
    "we want to go to the party on friday.",
    "they want to go to the pool this summer.",
    "he wants to go to the museum with his class.",

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
    // v2 additions
    "i am going to the playground with my niece.",
    "i am going to the party after work.",
    "i am going to the pool this weekend.",
    "i am going to the market later.",
    "i am going to the museum with friends.",
    "he is going to the mall after lunch.",

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

    // ======================================================================
    // v2 additions (ADR-0005 / IMPL-0005) — corpus grown ~3x for the larger,
    // log²-weighted training set. The templates below through "i really need
    // to ___" are deliberately designed so their completions cluster around
    // shared first letters (mostly p/m), giving the active-typing prefix
    // filter (e.g. "the p" -> park/playground/party) real width to narrow.
    // ======================================================================

    // "i need a ___"
    "i need a pen to sign this.",
    "i need a plan for tomorrow.",
    "i need a phone charger right now.",
    "i need a place to stay tonight.",
    "i need a partner for this project.",
    "i need a moment to think.",
    "i need a map to find the trail.",
    "i need a minute before we start.",
    "i need a break from this.",
    "i need a ride to the airport.",

    // "can you bring the ___"
    "can you bring the pizza when you come.",
    "can you bring the plates for dinner.",
    "can you bring the paperwork tomorrow.",
    "can you bring the projector to the meeting.",
    "can you bring the mail inside.",
    "can you bring the mop from the closet.",
    "can you bring the menu over here.",
    "can you bring the blanket outside.",
    "can you bring the charger please.",
    "can you bring the umbrella today.",

    // "i love the ___"
    "i love the park near our house.",
    "i love the peace and quiet here.",
    "i love the pizza from that place.",
    "i love the pool at this hotel.",
    "i love the movie we watched.",
    "i love the music playing right now.",
    "i love the mountains in the fall.",
    "i love the beach at sunset.",
    "i love the smell of fresh bread.",
    "i love the way you laugh.",

    // "let's meet at the ___"
    "let's meet at the park at noon.",
    "let's meet at the plaza this afternoon.",
    "let's meet at the pool later.",
    "let's meet at the mall after work.",
    "let's meet at the museum on saturday.",
    "let's meet at the market tomorrow.",
    "let's meet at the coffee shop.",
    "let's meet at the office first.",
    "let's meet at the corner store.",
    "let's meet at the bus stop.",

    // "she went to the ___"
    "she went to the park this morning.",
    "she went to the pharmacy for medicine.",
    "she went to the pool after school.",
    "she went to the mall with friends.",
    "she went to the market this morning.",
    "she went to the museum yesterday.",
    "she went to the library after class.",
    "she went to the doctor for a checkup.",
    "she went to the bank before lunch.",
    "she went to the gym after work.",

    // "we visited the ___"
    "we visited the park last weekend.",
    "we visited the palace on our trip.",
    "we visited the pyramids in egypt.",
    "we visited the museum downtown.",
    "we visited the mall for the sale.",
    "we visited the mountains last summer.",
    "we visited the beach in july.",
    "we visited the zoo with the kids.",
    "we visited the castle in the city.",
    "we visited the aquarium on saturday.",

    // "please pass the ___"
    "please pass the salt and pepper.",
    "please pass the potatoes down here.",
    "please pass the plate to your left.",
    "please pass the pitcher of water.",
    "please pass the milk please.",
    "please pass the mashed potatoes.",
    "please pass the mustard for the sandwich.",
    "please pass the bread basket.",
    "please pass the butter please.",
    "please pass the sauce over here.",

    // "i bought a new ___"
    "i bought a new phone yesterday.",
    "i bought a new pair of shoes.",
    "i bought a new printer for work.",
    "i bought a new pillow for my bed.",
    "i bought a new mattress last week.",
    "i bought a new microwave for the kitchen.",
    "i bought a new monitor for my desk.",
    "i bought a new car last month.",
    "i bought a new backpack for school.",
    "i bought a new jacket for winter.",

    // "the best part is the ___"
    "the best part is the ending.",
    "the best part is the pizza.",
    "the best part is the party after.",
    "the best part is the prize.",
    "the best part is the music.",
    "the best part is the memories.",
    "the best part is the mountains.",
    "the best part is the beach.",
    "the best part is the food.",
    "the best part is the friends.",

    // "i want some ___"
    "i want some pizza tonight.",
    "i want some peace and quiet.",
    "i want some privacy please.",
    "i want some popcorn for the movie.",
    "i want some milk in my coffee.",
    "i want some more time to think.",
    "i want some music playing.",
    "i want some space to breathe.",
    "i want some coffee first.",
    "i want some water please.",

    // "can you find the ___"
    "can you find the phone charger.",
    "can you find the paperwork please.",
    "can you find the price tag.",
    "can you find the parking lot.",
    "can you find the map for us.",
    "can you find the menu online.",
    "can you find the mistake in this.",
    "can you find the remote control.",
    "can you find the exit sign.",
    "can you find the keys somewhere.",

    // "let's order ___"
    "let's order pizza for dinner.",
    "let's order pasta tonight.",
    "let's order pad thai from that place.",
    "let's order more food.",
    "let's order mexican tonight.",
    "let's order milkshakes too.",
    "let's order chinese food.",
    "let's order sushi instead.",
    "let's order dessert too.",
    "let's order drinks first.",

    // "i really need to ___"
    "i really need to pack for the trip.",
    "i really need to plan this out.",
    "i really need to practice more.",
    "i really need to prioritize my time.",
    "i really need to move faster.",
    "i really need to manage my time.",
    "i really need to make a decision.",
    "i really need to focus right now.",
    "i really need to relax a bit.",
    "i really need to sleep tonight.",

    // ======================================================================
    // v2 additions, continued — general-diversity templates (no deliberate
    // prefix clustering) to broaden vocabulary and topics for the larger
    // corpus and its log²-weighted training.
    // ======================================================================

    // "i am excited about ___"
    "i am excited about the trip next week.",
    "i am excited about starting my new job.",
    "i am excited about seeing you again.",
    "i am excited about the concert tonight.",
    "i am excited about graduating this year.",

    // "we finally decided to ___"
    "we finally decided to buy the house.",
    "we finally decided to go on vacation.",
    "we finally decided to adopt a dog.",
    "we finally decided to move to the city.",
    "we finally decided to start the project.",

    // "he forgot to ___"
    "he forgot to lock the door.",
    "he forgot to bring his wallet.",
    "he forgot to call his mother.",
    "he forgot to turn off the lights.",
    "he forgot to feed the dog.",

    // "the kids are ___"
    "the kids are playing in the yard.",
    "the kids are watching a movie.",
    "the kids are doing their homework.",
    "the kids are asleep already.",
    "the kids are excited about the trip.",

    // "my parents are ___"
    "my parents are visiting next weekend.",
    "my parents are proud of me.",
    "my parents are coming for dinner.",
    "my parents are traveling this summer.",
    "my parents are retired now.",

    // "the store is ___"
    "the store is closed on sundays.",
    "the store is having a sale.",
    "the store is right around the corner.",
    "the store is out of milk.",
    "the store is busy today.",

    // "i finished ___"
    "i finished my homework early.",
    "i finished reading that book.",
    "i finished the report last night.",
    "i finished cleaning the house.",
    "i finished the race in an hour.",

    // "she started ___"
    "she started a new job today.",
    "she started running every morning.",
    "she started her own business.",
    "she started painting last year.",
    "she started college in the fall.",

    // "we watched ___"
    "we watched a movie last night.",
    "we watched the sunset together.",
    "we watched the game at the bar.",
    "we watched a documentary about space.",
    "we watched the fireworks on the fourth.",

    // "the dog is ___"
    "the dog is barking outside.",
    "the dog is sleeping on the couch.",
    "the dog is hungry again.",
    "the dog is very friendly.",
    "the dog is chasing its tail.",

    // "i can hear ___"
    "i can hear the rain outside.",
    "i can hear music from next door.",
    "i can hear you perfectly.",
    "i can hear the birds singing.",
    "i can hear the phone ringing.",

    // "the weather forecast says ___"
    "the weather forecast says rain tomorrow.",
    "the weather forecast says snow this weekend.",
    "the weather forecast says sunshine all week.",
    "the weather forecast says storms are coming.",
    "the weather forecast says clouds today.",

    // "i usually ___"
    "i usually wake up at seven.",
    "i usually eat breakfast at home.",
    "i usually walk to work.",
    "i usually drive to school.",
    "i usually study in the library.",

    // "she always ___"
    "she always forgets her umbrella.",
    "she always remembers my birthday.",
    "she always brings snacks.",
    "she always helps her friends.",
    "she always smiles at strangers.",

    // "we never ___"
    "we never argue about money.",
    "we never complain about the weather.",
    "we never forget our anniversary.",
    "we never miss a deadline.",
    "we never cancel our plans.",

    // "he sometimes ___"
    "he sometimes forgets his keys.",
    "he sometimes sleeps in late.",
    "he sometimes works from home.",
    "he sometimes travels for business.",
    "he sometimes cooks dinner.",

    // "they often ___"
    "they often visit on weekends.",
    "they often call in the evening.",
    "they often text before dinner.",
    "they often invite us over.",
    "they often help with chores.",

    // "my sister is ___"
    "my sister is studying for finals.",
    "my sister is working late tonight.",
    "my sister is traveling next month.",
    "my sister is sleeping right now.",
    "my sister is cooking dinner.",

    // "my brother wants ___"
    "my brother wants a car for his birthday.",
    "my brother wants a new job.",
    "my brother wants a dog someday.",
    "my brother wants a break from work.",
    "my brother wants a raise this year.",

    // "our neighbors are ___"
    "our neighbors are very friendly.",
    "our neighbors are a bit loud.",
    "our neighbors are pretty quiet.",
    "our neighbors are moving next month.",
    "our neighbors are traveling this summer.",

    // "the teacher asked us to ___"
    "the teacher asked us to read the chapter.",
    "the teacher asked us to write an essay.",
    "the teacher asked us to study for the quiz.",
    "the teacher asked us to practice daily.",
    "the teacher asked us to present tomorrow.",

    // "the boss wants ___"
    "the boss wants a report by friday.",
    "the boss wants a meeting this afternoon.",
    "the boss wants feedback on the project.",
    "the boss wants updates every week.",
    "the boss wants results by monday.",

    // "the doctor said to ___"
    "the doctor said to rest for a week.",
    "the doctor said to exercise more.",
    "the doctor said to drink more water.",
    "the doctor said to eat healthier.",
    "the doctor said to sleep eight hours.",

    // "the coach told us to ___"
    "the coach told us to practice harder.",
    "the coach told us to run faster.",
    "the coach told us to stretch first.",
    "the coach told us to focus more.",
    "the coach told us to hustle.",

    // "my friend just ___"
    "my friend just called me.",
    "my friend just texted me back.",
    "my friend just arrived home.",
    "my friend just left the party.",
    "my friend just moved to a new city.",

    // "the plane is ___"
    "the plane is delayed an hour.",
    "the plane is boarding now.",
    "the plane is landing soon.",
    "the plane is departing at noon.",
    "the plane is completely full.",

    // "the train arrives ___"
    "the train arrives soon.",
    "the train arrives late tonight.",
    "the train arrives early tomorrow.",
    "the train arrives at noon.",
    "the train arrives tomorrow morning.",

    // "the movie starts ___"
    "the movie starts soon.",
    "the movie starts tonight at eight.",
    "the movie starts a bit late.",
    "the movie starts early this time.",
    "the movie starts tomorrow evening.",

    // "traffic is ___"
    "traffic is heavy this morning.",
    "traffic is light today.",
    "traffic is terrible on the highway.",
    "traffic is moving slowly.",
    "traffic is backed up for miles.",

    // "the internet is ___"
    "the internet is down again.",
    "the internet is really slow today.",
    "the internet is fast enough now.",
    "the internet is finally working.",
    "the internet is back online.",

    // "my computer keeps ___"
    "my computer keeps crashing today.",
    "my computer keeps freezing randomly.",
    "my computer keeps restarting itself.",
    "my computer keeps lagging badly.",
    "my computer keeps updating automatically.",

    // "the restaurant serves ___"
    "the restaurant serves pizza on fridays.",
    "the restaurant serves pasta every night.",
    "the restaurant serves sushi on weekends.",
    "the restaurant serves tacos on tuesdays.",
    "the restaurant serves salads at lunch.",
    "the restaurant serves burgers too.",
    "the restaurant serves soup daily.",
    "the restaurant serves dessert after dinner.",

    // "the party starts ___"
    "the party starts soon.",
    "the party starts tonight at seven.",
    "the party starts a little late.",
    "the party starts early this year.",
    "the party starts tomorrow evening.",
    "the party starts at seven sharp.",
    "the party starts at noon.",
    "the party starts this weekend.",

    // "the concert was ___"
    "the concert was amazing last night.",
    "the concert was really loud.",
    "the concert was sold out.",
    "the concert was incredible overall.",
    "the concert was so much fun.",
    "the concert was a bit long.",
    "the concert was very crowded.",
    "the concert was unforgettable.",

    // "the game ends ___"
    "the game ends soon.",
    "the game ends tonight around nine.",
    "the game ends pretty late.",
    "the game ends at nine sharp.",
    "the game ends in overtime probably.",
    "the game ends earlier than usual.",
    "the game ends tomorrow instead.",
    "the game ends within the hour.",

    // "the flight leaves ___"
    "the flight leaves soon.",
    "the flight leaves tonight at nine.",
    "the flight leaves early tomorrow.",
    "the flight leaves at six sharp.",
    "the flight leaves tomorrow morning.",
    "the flight leaves from gate five.",
    "the flight leaves in an hour.",
    "the flight leaves this afternoon.",

    // "the class starts ___"
    "the class starts soon.",
    "the class starts at nine sharp.",
    "the class starts tomorrow morning.",
    "the class starts next week.",
    "the class starts in ten minutes.",
    "the class starts this afternoon.",
    "the class starts monday.",
    "the class starts a bit late.",

    // "the store closes ___"
    "the store closes soon.",
    "the store closes at nine tonight.",
    "the store closes early today.",
    "the store closes tonight at ten.",
    "the store closes tomorrow for renovations.",
    "the store closes at noon on sundays.",
    "the store closes for the holiday.",
    "the store closes a bit late.",

    // "the bakery sells ___"
    "the bakery sells fresh bread daily.",
    "the bakery sells warm croissants.",
    "the bakery sells homemade cookies.",
    "the bakery sells birthday cakes.",
    "the bakery sells blueberry muffins.",
    "the bakery sells glazed donuts.",
    "the bakery sells fresh bagels.",
    "the bakery sells french pastries.",

    // "the library closes at ___"
    "the library closes at five today.",
    "the library closes at six on fridays.",
    "the library closes at seven usually.",
    "the library closes at eight tonight.",
    "the library closes at nine on weekdays.",
    "the library closes at noon on sundays.",
    "the library closes at midnight during finals.",
    "the library closes at ten this week.",

    // "she plays the ___"
    "she plays the piano beautifully.",
    "she plays the guitar every evening.",
    "she plays the violin in the orchestra.",
    "she plays the drums in a band.",
    "she plays the flute at recitals.",
    "she plays the trumpet in jazz band.",
    "she plays the cello quite well.",
    "she plays the saxophone on weekends.",

    // "he drives a ___"
    "he drives a truck to work.",
    "he drives a car every day.",
    "he drives a van for deliveries.",
    "he drives a motorcycle on weekends.",
    "he drives a jeep off-road.",
    "he drives a sedan around town.",
    "he drives a hybrid to save gas.",
    "he drives a scooter to campus.",

    // "we ordered ___"
    "we ordered pizza for the party.",
    "we ordered tacos from the truck.",
    "we ordered sushi last night.",
    "we ordered burgers and fries.",
    "we ordered noodles for lunch.",
    "we ordered salad instead.",
    "we ordered wings for the game.",
    "we ordered soup to warm up.",

    // "the chef prepared ___"
    "the chef prepared pasta for the table.",
    "the chef prepared soup to start.",
    "the chef prepared a fresh salad.",
    "the chef prepared steak to order.",
    "the chef prepared dessert for everyone.",
    "the chef prepared appetizers first.",
    "the chef prepared seafood specials.",
    "the chef prepared tacos for the event.",

    // "the mechanic fixed ___"
    "the mechanic fixed the engine quickly.",
    "the mechanic fixed the brakes yesterday.",
    "the mechanic fixed the tires this morning.",
    "the mechanic fixed the battery for free.",
    "the mechanic fixed the transmission finally.",
    "the mechanic fixed the exhaust system.",
    "the mechanic fixed the radiator leak.",
    "the mechanic fixed the alternator too.",

    // "the nurse checked ___"
    "the nurse checked my blood pressure first.",
    "the nurse checked my temperature quickly.",
    "the nurse checked my pulse next.",
    "the nurse checked my weight too.",
    "the nurse checked my heart rate.",
    "the nurse checked my reflexes.",
    "the nurse checked my vision.",
    "the nurse checked my hearing.",

    // "the artist painted ___"
    "the artist painted a beautiful landscape.",
    "the artist painted a stunning portrait.",
    "the artist painted the sunset perfectly.",
    "the artist painted a huge mural.",
    "the artist painted a quiet still life.",
    "the artist painted the ocean waves.",
    "the artist painted a self portrait.",
    "the artist painted an abstract piece.",

    // "the writer finished ___"
    "the writer finished the novel finally.",
    "the writer finished the chapter today.",
    "the writer finished the first draft.",
    "the writer finished the article on time.",
    "the writer finished the poem last night.",
    "the writer finished the script early.",
    "the writer finished the outline yesterday.",
    "the writer finished the essay quickly.",

    // "the farmer grows ___"
    "the farmer grows corn every summer.",
    "the farmer grows wheat on this land.",
    "the farmer grows tomatoes in the greenhouse.",
    "the farmer grows potatoes for the market.",
    "the farmer grows soybeans this season.",
    "the farmer grows strawberries in spring.",
    "the farmer grows pumpkins every fall.",
    "the farmer grows carrots too.",

    // "the engineer designed ___"
    "the engineer designed a new bridge.",
    "the engineer designed the office building.",
    "the engineer designed the whole system.",
    "the engineer designed a small machine.",
    "the engineer designed the circuit board.",
    "the engineer designed a helpful robot.",
    "the engineer designed a mobile app.",
    "the engineer designed the database.",

    // "the pilot announced ___"
    "the pilot announced turbulence ahead.",
    "the pilot announced a short delay.",
    "the pilot announced the landing time.",
    "the pilot announced the weather conditions.",
    "the pilot announced a route change.",
    "the pilot announced our current altitude.",
    "the pilot announced a quick update.",
    "the pilot announced our arrival time.",
];
