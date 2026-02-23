/**
 * Analyze workflow steps from conversation flow
 * 
 * This script helps estimate how many steps a workflow should have
 * based on the conversation flow structure.
 */

const conversationFlow = `
1. PAUSE - Wait for caller
2. SENTIMENT GATE 1 (Decision)
   - Branch A: Neutral/Positive → Section 3
   - Branch B: Lukewarm/Negative → Section 2A → Section 3
3. ADDRESS CONCERNS (2A) - Conditional
4. FIT QUESTION - Ask about market
5. SENTIMENT GATE 2 (Decision)
   - Branch A: Neutral/Positive → Section 4B
   - Branch B: Lukewarm/Negative → Section 4A → Section 5
6. WIN BACK TRUST (4A) - Conditional
7. TRANSITION TO EVALUATION (4B)
8. QUALIFICATION QUESTIONS - Multiple questions (goal, range, accredited, timeline)
9. BOOKING TRANSITION - Move to calendar
10. DECISION READINESS (Decision)
    - Branch A: No Hesitation → Section 7A
    - Branch B: Hesitation → Section 7B → Loop back
11. SET EXPECTATIONS & BOOK (7A) - Tool call
12. HANDLE HESITATION (7B) - Diagnostic + loop
13. COMPLETE - End workflow

Plus:
- Objection handling (multiple decision branches)
- Support redirect (decision branch)
- Bad fit exit (decision branch)
`;

console.log("Workflow Step Analysis:");
console.log("======================");
console.log("\nCore Linear Flow: ~8-10 steps");
console.log("With Decision Branches: ~12-15 steps");
console.log("With Objection Handling: ~18-22 steps");
console.log("With All Edge Cases: ~25-30 steps");
console.log("\nRecommended Structure:");
console.log("- Main flow: 10-12 steps");
console.log("- Decision points: 3-4 steps");
console.log("- Conditional paths: 4-6 steps");
console.log("- Tool calls: 1-2 steps (book appointment, create contact)");
console.log("- Complete: 1 step");
console.log("\nTotal Estimated: 18-25 steps");
