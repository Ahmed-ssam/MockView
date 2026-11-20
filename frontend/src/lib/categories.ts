// The 11 categories from the product spec. Counts are validated against the API in backend tests.
export const CATEGORIES: { name: string; count: number; examples: string[] }[] = [
  { name: "Software Development & Engineering", count: 5, examples: ["Web", "Mobile", "Game"] },
  { name: "Artificial Intelligence & Machine Learning", count: 6, examples: ["ML", "NLP", "GenAI"] },
  { name: "Data & Analytics", count: 5, examples: ["Data Science", "BI"] },
  { name: "Cybersecurity", count: 5, examples: ["Pentesting", "Forensics"] },
  { name: "Cloud & Infrastructure", count: 7, examples: ["DevOps", "SRE"] },
  { name: "Design & User Experience", count: 3, examples: ["UX", "UI", "Product"] },
  { name: "Blockchain & Web3", count: 3, examples: ["Smart Contracts"] },
  { name: "Hardware & Emerging Technologies", count: 6, examples: ["IoT", "Robotics", "XR"] },
  { name: "Testing & Quality Assurance", count: 2, examples: ["QA", "Automation"] },
  { name: "Technical Management & Systems", count: 3, examples: ["TPM", "Systems Eng."] },
  { name: "Specialized Technologies", count: 19, examples: ["Quantum", "FinTech", "GRC"] },
];
