"""Data-driven catalog of all 64 specializations.

Each entry: (name, description, topics, tools, radar_dimensions[6]).
Question categories, difficulty config and learning topics are derived in
`build_config`, so every specialization gets a full configuration while the
distinguishing content (topics, tools, dimensions) is specific to it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

COMM = "Communication"

CATALOG: dict[str, list[tuple]] = {
    "Software Development & Engineering": [
        ("Web Development", "Front-end and back-end engineering for browser-based products.",
         ["HTTP & REST", "JavaScript/TypeScript", "Browser rendering", "State management", "Web performance", "Auth & sessions"],
         ["React", "Node.js", "CSS", "PostgreSQL"],
         ["Web Fundamentals", "Frontend Engineering", "Backend & APIs", "Problem Solving", "Performance & Security", COMM]),
        ("Mobile App Development", "Native and cross-platform apps for iOS and Android.",
         ["App lifecycle", "Navigation & state", "Offline storage", "Push notifications", "Mobile performance", "App store release"],
         ["Swift", "Kotlin", "Flutter", "React Native"],
         ["Mobile Fundamentals", "Platform Knowledge", "Architecture", "Problem Solving", "Performance & UX", COMM]),
        ("Desktop Software Development", "Applications for Windows, macOS and Linux.",
         ["GUI frameworks", "Threading & concurrency", "File & OS APIs", "Packaging & updates", "Memory management", "Cross-platform design"],
         [".NET", "Qt", "Electron", "C++"],
         ["Programming Fundamentals", "GUI Architecture", "Concurrency", "Problem Solving", "OS Integration", COMM]),
        ("Game Development", "Real-time interactive games and engines.",
         ["Game loop", "Physics & collision", "Rendering basics", "AI for NPCs", "Optimization", "Asset pipelines"],
         ["Unity", "Unreal Engine", "C#", "C++"],
         ["Game Programming", "Engine Knowledge", "Math & Physics", "Problem Solving", "Performance", COMM]),
        ("Software Engineering", "General software design, algorithms and engineering practice.",
         ["Data structures & algorithms", "System design", "Design patterns", "Testing", "Version control", "Code review"],
         ["Git", "CI/CD", "Docker", "SQL"],
         ["Programming Fundamentals", "Data Structures & Algorithms", "System Design", "Problem Solving", "Code Quality", COMM]),
    ],
    "Artificial Intelligence & Machine Learning": [
        ("Artificial Intelligence", "Core AI methods, search, reasoning and applied intelligent systems.",
         ["Search & planning", "Knowledge representation", "Probabilistic reasoning", "Learning paradigms", "AI ethics & safety", "Evaluation"],
         ["Python", "PyTorch", "scikit-learn"],
         ["AI Fundamentals", "Reasoning & Search", "Learning Methods", "Problem Solving", "Responsible AI", COMM]),
        ("Machine Learning", "Building, evaluating and deploying predictive models.",
         ["Supervised vs unsupervised", "Data preprocessing", "Feature engineering", "Model evaluation", "Model optimization", "MLOps"],
         ["scikit-learn", "XGBoost", "MLflow", "Pandas"],
         ["ML Fundamentals", "Mathematical Understanding", "Model Evaluation", "Problem Solving", "Practical Implementation", COMM]),
        ("Deep Learning", "Neural network architectures and training.",
         ["Backpropagation", "CNN/RNN/Transformers", "Regularization", "Optimization", "Transfer learning", "GPU training"],
         ["PyTorch", "TensorFlow", "CUDA"],
         ["DL Fundamentals", "Architectures", "Training & Optimization", "Problem Solving", "Practical Implementation", COMM]),
        ("Natural Language Processing", "Language understanding and generation systems.",
         ["Tokenization & embeddings", "Transformers", "Text classification", "Sequence labeling", "Evaluation metrics", "Multilingual NLP"],
         ["spaCy", "Hugging Face", "NLTK"],
         ["NLP Fundamentals", "Language Models", "Evaluation", "Problem Solving", "Practical Implementation", COMM]),
        ("Computer Vision", "Image and video understanding.",
         ["Convolutions", "Detection & segmentation", "Data augmentation", "Camera geometry", "Model deployment", "Metrics (mAP, IoU)"],
         ["OpenCV", "PyTorch", "YOLO"],
         ["CV Fundamentals", "Model Architectures", "Evaluation", "Problem Solving", "Practical Implementation", COMM]),
        ("Generative AI", "LLM and diffusion applications, prompting and RAG.",
         ["LLM internals", "Prompt engineering", "RAG", "Fine-tuning", "Evaluation & hallucination", "Safety & guardrails"],
         ["LLM APIs", "Vector databases", "LangChain", "Diffusers"],
         ["GenAI Fundamentals", "Prompting & RAG", "Evaluation & Safety", "Problem Solving", "Practical Implementation", COMM]),
    ],
    "Data & Analytics": [
        ("Data Science", "Statistical modelling and data-driven insight.",
         ["Statistics", "Hypothesis testing", "Feature engineering", "Modelling", "Experiment design", "Data storytelling"],
         ["Python", "Pandas", "Jupyter", "SQL"],
         ["Statistics", "Modelling", "Data Wrangling", "Problem Solving", "Business Insight", COMM]),
        ("Data Analytics", "Analysing data to support decisions.",
         ["SQL analysis", "Descriptive statistics", "Data cleaning", "KPIs & metrics", "Visualization", "A/B testing"],
         ["SQL", "Excel", "Tableau", "Python"],
         ["Analytical Fundamentals", "SQL & Querying", "Visualization", "Problem Solving", "Business Insight", COMM]),
        ("Data Engineering", "Pipelines, warehouses and data platforms.",
         ["ETL/ELT", "Data modelling", "Orchestration", "Streaming", "Data quality", "Warehousing"],
         ["Airflow", "dbt", "Spark", "Kafka"],
         ["Data Fundamentals", "Pipeline Design", "Data Modelling", "Problem Solving", "Reliability & Quality", COMM]),
        ("Big Data", "Distributed processing at scale.",
         ["Distributed systems", "MapReduce/Spark", "Partitioning", "Storage formats", "Stream processing", "Cluster tuning"],
         ["Spark", "Hadoop", "Kafka", "Parquet"],
         ["Big Data Fundamentals", "Distributed Processing", "Storage & Formats", "Problem Solving", "Performance Tuning", COMM]),
        ("Business Intelligence", "Reporting, dashboards and semantic models.",
         ["Dimensional modelling", "KPI design", "Dashboards", "DAX/SQL", "Self-service BI", "Data governance"],
         ["Power BI", "Tableau", "Looker", "SQL"],
         ["BI Fundamentals", "Data Modelling", "Dashboard Design", "Problem Solving", "Business Insight", COMM]),
    ],
    "Cybersecurity": [
        ("Cybersecurity", "Defending systems, networks and data.",
         ["Networking", "Operating systems", "Authentication", "Vulnerability assessment", "OWASP", "Incident response"],
         ["Wireshark", "Nmap", "SIEM", "Burp Suite"],
         ["Security Fundamentals", "Vulnerability Analysis", "Networking Knowledge", "Security Tools", "Practical Security Skills", "Incident Response"]),
        ("Information Security", "Policies, controls and risk-based protection of information.",
         ["CIA triad", "Access control", "Cryptography", "Security policies", "Risk assessment", "Awareness"],
         ["ISO 27001", "IAM", "DLP"],
         ["Security Fundamentals", "Controls & Policy", "Cryptography", "Risk Assessment", "Practical Application", COMM]),
        ("Ethical Hacking & Penetration Testing", "Authorised offensive testing.",
         ["Recon & enumeration", "Exploitation methodology", "Privilege escalation", "Web & network pentesting", "Reporting", "Rules of engagement"],
         ["Metasploit", "Burp Suite", "Nmap", "Kali Linux"],
         ["Pentest Methodology", "Exploitation Knowledge", "Web & Network", "Tooling", "Reporting", "Ethics & Scope"]),
        ("Network Security", "Securing network infrastructure.",
         ["Firewalls & segmentation", "VPN & TLS", "IDS/IPS", "Zero trust", "Wireless security", "DDoS defence"],
         ["pfSense", "Snort", "Wireshark"],
         ["Network Fundamentals", "Perimeter Defence", "Encryption & VPN", "Monitoring", "Practical Skills", "Incident Response"]),
        ("Digital Forensics", "Evidence acquisition and analysis.",
         ["Chain of custody", "Disk & memory forensics", "Log analysis", "File systems", "Timeline analysis", "Reporting"],
         ["Autopsy", "Volatility", "FTK"],
         ["Forensic Fundamentals", "Acquisition", "Analysis", "Tools", "Legal & Chain of Custody", "Reporting"]),
    ],
    "Cloud & Infrastructure": [
        ("Cloud Computing", "Cloud concepts and service models.",
         ["IaaS/PaaS/SaaS", "Shared responsibility", "Elasticity", "Cost management", "Networking in cloud", "Storage"],
         ["AWS", "Azure", "GCP"],
         ["Cloud Fundamentals", "Services Knowledge", "Cost & Governance", "Problem Solving", "Security", COMM]),
        ("Cloud Engineering", "Designing and operating cloud platforms.",
         ["Infrastructure as code", "VPC design", "Serverless", "Containers", "Identity & access", "High availability"],
         ["Terraform", "Kubernetes", "AWS", "Azure"],
         ["Cloud Architecture", "Infrastructure as Code", "Networking & Security", "Problem Solving", "Operations", COMM]),
        ("DevOps", "Delivery pipelines and operational automation.",
         ["CI/CD", "Containers", "IaC", "Monitoring", "Release strategies", "Git workflows"],
         ["Jenkins", "GitHub Actions", "Docker", "Kubernetes"],
         ["DevOps Fundamentals", "CI/CD & Automation", "Infrastructure", "Problem Solving", "Monitoring", COMM]),
        ("Site Reliability Engineering", "Reliability, SLOs and incident management.",
         ["SLI/SLO/error budgets", "Incident response", "Capacity planning", "Observability", "Postmortems", "Toil reduction"],
         ["Prometheus", "Grafana", "Kubernetes"],
         ["SRE Fundamentals", "Observability", "Incident Management", "Problem Solving", "Automation", COMM]),
        ("Network Engineering", "Designing and running enterprise networks.",
         ["TCP/IP & routing", "VLANs & switching", "BGP/OSPF", "Network design", "Troubleshooting", "SD-WAN"],
         ["Cisco IOS", "Juniper", "Wireshark"],
         ["Networking Fundamentals", "Routing & Switching", "Design", "Troubleshooting", "Automation", COMM]),
        ("System Administration", "Operating servers and services.",
         ["Linux/Windows administration", "User & permission management", "Backup & recovery", "Patching", "Scripting", "Monitoring"],
         ["Linux", "PowerShell", "Ansible"],
         ["OS Fundamentals", "Administration", "Automation & Scripting", "Troubleshooting", "Security Hygiene", COMM]),
        ("Database Administration", "Running reliable, performant databases.",
         ["Indexing & query tuning", "Backup & recovery", "Replication", "Transactions & locking", "Security", "Capacity planning"],
         ["PostgreSQL", "MySQL", "SQL Server", "Oracle"],
         ["Database Fundamentals", "Performance Tuning", "Backup & Recovery", "Troubleshooting", "High Availability", COMM]),
    ],
    "Design & User Experience": [
        ("UX Design", "Designing usable, useful product experiences.",
         ["Design principles", "User research", "Information architecture", "Interaction design", "Usability testing", "Accessibility"],
         ["Figma", "Miro", "Maze"],
         ["Design Thinking", "User Research", "Interaction Design", "Usability", "Design Decisions", COMM]),
        ("UI Design", "Visual interface design and design systems.",
         ["Layout & hierarchy", "Typography", "Color theory", "Design systems", "Prototyping", "Accessibility"],
         ["Figma", "Sketch", "Adobe XD"],
         ["Design Principles", "Visual Design", "Design Systems", "Prototyping", "Accessibility", COMM]),
        ("Product Design", "End-to-end product thinking from problem to shipped UI.",
         ["Problem framing", "Discovery", "Prototyping", "Metrics", "Stakeholder alignment", "Design critique"],
         ["Figma", "FigJam", "Amplitude"],
         ["Product Thinking", "User Research", "Interaction & Visual Design", "Problem Solving", "Impact & Metrics", COMM]),
    ],
    "Blockchain & Web3": [
        ("Blockchain", "Distributed ledger fundamentals and architecture.",
         ["Consensus", "Cryptographic hashing", "Transactions & blocks", "Wallets & keys", "Scalability", "Tokenomics"],
         ["Ethereum", "Bitcoin", "Hyperledger"],
         ["Blockchain Fundamentals", "Consensus", "Cryptography", "Problem Solving", "Practical Understanding", COMM]),
        ("Web3 Development", "Building dApps and wallet-integrated frontends.",
         ["dApp architecture", "Wallet integration", "Indexing", "Gas & fees", "IPFS", "Security"],
         ["ethers.js", "Hardhat", "The Graph"],
         ["Web3 Fundamentals", "dApp Development", "Smart Contract Interaction", "Problem Solving", "Security", COMM]),
        ("Smart Contracts", "Writing and auditing on-chain programs.",
         ["Solidity patterns", "Gas optimization", "Reentrancy & common bugs", "Upgradeability", "Testing", "Auditing"],
         ["Solidity", "Foundry", "Hardhat"],
         ["Contract Fundamentals", "Security Vulnerabilities", "Gas Optimization", "Testing", "Design Patterns", COMM]),
    ],
    "Hardware & Emerging Technologies": [
        ("Internet of Things", "Connected devices and telemetry.",
         ["Sensors & actuators", "MQTT/CoAP", "Device security", "Edge vs cloud", "Power management", "OTA updates"],
         ["Arduino", "Raspberry Pi", "MQTT", "AWS IoT"],
         ["IoT Fundamentals", "Connectivity", "Device Security", "System Design", "Practical Implementation", COMM]),
        ("Embedded Systems", "Firmware for resource-constrained hardware.",
         ["Microcontrollers", "Interrupts & timers", "RTOS", "Communication buses", "Memory constraints", "Debugging"],
         ["C", "STM32", "FreeRTOS", "Oscilloscope"],
         ["Embedded Fundamentals", "Low-level Programming", "RTOS & Concurrency", "Hardware Interfaces", "Debugging", COMM]),
        ("Robotics", "Perception, planning and control.",
         ["Kinematics", "Sensors & perception", "Control theory", "Path planning", "SLAM", "Safety"],
         ["ROS", "Gazebo", "Python", "C++"],
         ["Robotics Fundamentals", "Control & Kinematics", "Perception", "Planning", "Practical Implementation", COMM]),
        ("Virtual Reality", "Immersive VR applications.",
         ["Rendering performance", "Tracking & input", "Locomotion & comfort", "Spatial audio", "Interaction design", "Optimization"],
         ["Unity", "Unreal", "OpenXR"],
         ["VR Fundamentals", "Interaction Design", "Performance", "Comfort & UX", "Practical Implementation", COMM]),
        ("Augmented Reality", "Overlaying digital content on the real world.",
         ["Tracking & SLAM", "Anchors & occlusion", "Marker vs markerless", "Mobile AR", "UX in AR", "Performance"],
         ["ARKit", "ARCore", "Unity AR Foundation"],
         ["AR Fundamentals", "Tracking & Mapping", "Interaction Design", "Performance", "Practical Implementation", COMM]),
        ("Extended Reality", "VR/AR/MR product strategy and engineering.",
         ["XR platforms", "Spatial computing", "Hand tracking", "Cross-platform XR", "Use-case design", "Privacy"],
         ["OpenXR", "Unity", "WebXR"],
         ["XR Fundamentals", "Platform Knowledge", "Spatial Interaction", "Problem Solving", "Practical Implementation", COMM]),
    ],
    "Testing & Quality Assurance": [
        ("Quality Assurance & Software Testing", "Planning and executing software quality activities.",
         ["Test design techniques", "Test planning", "Bug lifecycle", "Regression testing", "Exploratory testing", "Quality metrics"],
         ["Jira", "TestRail", "Postman"],
         ["Testing Fundamentals", "Test Design", "Defect Analysis", "Problem Solving", "Process & Metrics", COMM]),
        ("Test Automation", "Automated test frameworks and pipelines.",
         ["Test pyramid", "Page object & patterns", "Flaky tests", "API testing", "CI integration", "Test data"],
         ["Selenium", "Playwright", "Cypress", "pytest"],
         ["Automation Fundamentals", "Framework Design", "Code Quality", "Problem Solving", "CI Integration", COMM]),
    ],
    "Technical Management & Systems": [
        ("Technical Product Management", "Product strategy for technical products.",
         ["Roadmapping", "Prioritization", "Requirements", "Technical trade-offs", "Metrics", "Stakeholder management"],
         ["Jira", "Amplitude", "Figma"],
         ["Product Strategy", "Technical Understanding", "Prioritization", "Problem Solving", "Data & Metrics", COMM]),
        ("IT Project Management", "Delivering IT projects on time and scope.",
         ["Scope & schedule", "Risk management", "Agile vs waterfall", "Budgeting", "Stakeholders", "Delivery governance"],
         ["MS Project", "Jira", "Confluence"],
         ["PM Fundamentals", "Planning & Scheduling", "Risk Management", "Problem Solving", "Leadership", COMM]),
        ("Systems Engineering", "Requirements, architecture and integration of complex systems.",
         ["Requirements engineering", "System architecture", "Verification & validation", "Trade studies", "Interfaces", "Lifecycle models"],
         ["SysML", "DOORS", "MBSE tools"],
         ["Systems Fundamentals", "Requirements", "Architecture", "Verification", "Problem Solving", COMM]),
    ],
    "Specialized Technologies": [
        ("Quantum Computing", "Quantum algorithms and hardware concepts.",
         ["Qubits & superposition", "Gates & circuits", "Entanglement", "Shor/Grover", "Noise & error correction", "Hybrid algorithms"],
         ["Qiskit", "Cirq", "PennyLane"],
         ["Quantum Fundamentals", "Algorithms", "Linear Algebra", "Problem Solving", "Practical Implementation", COMM]),
        ("Edge Computing", "Compute near the data source.",
         ["Edge vs cloud", "Latency & bandwidth", "Model deployment on edge", "Orchestration", "Offline operation", "Security"],
         ["K3s", "AWS Greengrass", "TensorRT"],
         ["Edge Fundamentals", "Architecture", "Deployment", "Problem Solving", "Security", COMM]),
        ("Bioinformatics", "Computational analysis of biological data.",
         ["Sequence alignment", "Genomics pipelines", "Statistics", "Biological databases", "Reproducibility", "Visualization"],
         ["Biopython", "BLAST", "R/Bioconductor", "Nextflow"],
         ["Bioinformatics Fundamentals", "Sequence Analysis", "Statistics", "Pipelines", "Practical Implementation", COMM]),
        ("FinTech", "Financial technology products and platforms.",
         ["Payments", "Regulation & compliance", "Fraud detection", "Ledgers", "Risk", "APIs & open banking"],
         ["Stripe", "Plaid", "SQL"],
         ["FinTech Fundamentals", "Payments & Ledgers", "Compliance & Risk", "Problem Solving", "Security", COMM]),
        ("HealthTech", "Digital health systems and data.",
         ["HL7/FHIR", "HIPAA & privacy", "Clinical workflows", "Interoperability", "Medical device software", "Patient safety"],
         ["FHIR", "EHR systems", "DICOM"],
         ["HealthTech Fundamentals", "Interoperability", "Privacy & Compliance", "Problem Solving", "Clinical Context", COMM]),
        ("EdTech", "Learning platforms and educational technology.",
         ["Learning design", "LMS & standards", "Assessment", "Accessibility", "Engagement analytics", "Content delivery"],
         ["Moodle", "xAPI", "SCORM"],
         ["EdTech Fundamentals", "Learning Design", "Platform Engineering", "Problem Solving", "Analytics", COMM]),
        ("AgriTech", "Technology for agriculture.",
         ["Precision agriculture", "Remote sensing", "IoT sensors", "Yield modelling", "Supply chain", "Sustainability"],
         ["GIS", "Drones", "IoT sensors", "Python"],
         ["AgriTech Fundamentals", "Sensing & Data", "Modelling", "Problem Solving", "Practical Implementation", COMM]),
        ("Robotic Process Automation", "Automating rule-based business processes.",
         ["Process discovery", "Bot design", "Exception handling", "Orchestrator", "Governance", "ROI"],
         ["UiPath", "Automation Anywhere", "Power Automate"],
         ["RPA Fundamentals", "Bot Development", "Process Analysis", "Problem Solving", "Governance", COMM]),
        ("UX Research", "Evidence-based understanding of users.",
         ["Research methods", "Interview technique", "Survey design", "Synthesis", "Usability testing", "Research ethics"],
         ["Dovetail", "UserTesting", "Maze"],
         ["Research Methods", "Interviewing", "Synthesis & Insight", "Study Design", "Research Ethics", COMM]),
        ("Technical Writing", "Clear documentation for technical audiences.",
         ["Audience analysis", "Docs-as-code", "API documentation", "Information design", "Style guides", "Review workflows"],
         ["Markdown", "Git", "OpenAPI", "Docusaurus"],
         ["Writing Fundamentals", "Technical Accuracy", "Information Design", "Tooling", "Audience Awareness", COMM]),
        ("IT Support", "Helping users and maintaining IT services.",
         ["Troubleshooting methodology", "Windows/macOS/Linux", "Networking basics", "Ticketing & SLAs", "Account management", "Customer communication"],
         ["Active Directory", "ServiceNow", "Remote support tools"],
         ["IT Fundamentals", "Troubleshooting", "Systems & Networking", "Ticket Handling", "Security Hygiene", "Customer Communication"]),
        ("ERP Systems", "Enterprise resource planning implementation.",
         ["Core ERP modules", "Business process mapping", "Data migration", "Customization", "Integration", "Change management"],
         ["SAP", "Oracle ERP", "Dynamics 365"],
         ["ERP Fundamentals", "Business Processes", "Configuration", "Integration", "Problem Solving", COMM]),
        ("CRM Development", "Customising and integrating CRM platforms.",
         ["Data model", "Automation & workflows", "Integrations", "Apex/low-code", "Reporting", "Security model"],
         ["Salesforce", "HubSpot", "Dynamics CRM"],
         ["CRM Fundamentals", "Platform Development", "Data Model", "Integration", "Problem Solving", COMM]),
        ("High-Performance Computing", "Large-scale parallel computation.",
         ["Parallel algorithms", "MPI/OpenMP", "GPU computing", "Profiling", "Scheduling", "Memory hierarchy"],
         ["MPI", "OpenMP", "CUDA", "Slurm"],
         ["HPC Fundamentals", "Parallel Programming", "Performance Analysis", "Problem Solving", "Cluster Operations", COMM]),
        ("Digital Audio Engineering", "Audio DSP and production tooling.",
         ["Sampling & Nyquist", "Filters & DSP", "Latency", "Plugin development", "Mixing signal flow", "Codecs"],
         ["JUCE", "MATLAB", "Pro Tools", "Max/MSP"],
         ["Audio Fundamentals", "DSP", "Tools & Plugins", "Problem Solving", "Practical Implementation", COMM]),
        ("Computer Graphics", "Rendering and real-time graphics.",
         ["Rasterization & ray tracing", "Shaders", "Linear algebra", "Lighting models", "GPU pipeline", "Optimization"],
         ["OpenGL", "Vulkan", "GLSL", "Blender"],
         ["Graphics Fundamentals", "Math Foundations", "Shaders & Pipeline", "Problem Solving", "Performance", COMM]),
        ("Digital Twins", "Virtual replicas of physical assets.",
         ["Twin architecture", "Sensor data ingestion", "Simulation", "Synchronization", "Predictive maintenance", "Integration"],
         ["Azure Digital Twins", "Unity", "MQTT"],
         ["Digital Twin Fundamentals", "Data Integration", "Simulation & Modelling", "Problem Solving", "Practical Implementation", COMM]),
        ("Application Security", "Securing software throughout its lifecycle.",
         ["Secure SDLC", "OWASP Top 10", "SAST/DAST", "Threat modelling", "Dependency risk", "Secure code review"],
         ["Semgrep", "Burp Suite", "OWASP ZAP", "Snyk"],
         ["AppSec Fundamentals", "Vulnerability Analysis", "Threat Modelling", "Secure Coding", "Security Tooling", COMM]),
        ("Technology Governance, Risk & Compliance (GRC)", "Governance frameworks, risk and regulatory compliance.",
         ["Risk assessment", "Control frameworks (ISO/NIST)", "Audit", "Policy management", "Regulatory compliance", "Third-party risk"],
         ["ISO 27001", "NIST CSF", "GRC platforms"],
         ["GRC Fundamentals", "Frameworks & Controls", "Risk Assessment", "Audit & Evidence", "Policy & Compliance", COMM]),
    ],
}

DEFAULT_QUESTION_MIX = {
    "fundamentals": 2, "deep_dive": 2, "problem_solving": 2,
    "scenario": 2, "critical_thinking": 1, "behavioral": 1,
}
# Specializations where a different mix is more realistic (still exactly 10).
QUESTION_MIX_OVERRIDES = {
    "ux-design": {"fundamentals": 1, "deep_dive": 2, "problem_solving": 2, "scenario": 2, "critical_thinking": 1, "behavioral": 2},
    "ui-design": {"fundamentals": 1, "deep_dive": 2, "problem_solving": 2, "scenario": 2, "critical_thinking": 1, "behavioral": 2},
    "product-design": {"fundamentals": 1, "deep_dive": 2, "problem_solving": 2, "scenario": 2, "critical_thinking": 1, "behavioral": 2},
    "ux-research": {"fundamentals": 1, "deep_dive": 2, "problem_solving": 2, "scenario": 2, "critical_thinking": 1, "behavioral": 2},
    "technical-product-management": {"fundamentals": 1, "deep_dive": 1, "problem_solving": 2, "scenario": 3, "critical_thinking": 1, "behavioral": 2},
    "it-project-management": {"fundamentals": 1, "deep_dive": 1, "problem_solving": 2, "scenario": 3, "critical_thinking": 1, "behavioral": 2},
    "cybersecurity": {"fundamentals": 2, "deep_dive": 2, "problem_solving": 1, "scenario": 3, "critical_thinking": 1, "behavioral": 1},
    "technology-governance-risk-compliance-grc": {"fundamentals": 2, "deep_dive": 1, "problem_solving": 1, "scenario": 3, "critical_thinking": 2, "behavioral": 1},
}


def slugify(name: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


@dataclass
class SpecializationConfig:
    slug: str
    name: str
    category: str
    description: str
    core_competencies: list[str]
    technical_topics: list[str]
    tools: list[str]
    question_categories: dict[str, int]
    difficulty_config: dict[str, str]
    evaluation_dimensions: list[str]
    learning_topics: list[str]


DIFFICULTY_BY_LEVEL = {
    "intern": "Foundations, definitions and simple applied examples.",
    "junior": "Core concepts with guided practical scenarios.",
    "mid": "Trade-offs, debugging and independent design decisions.",
    "senior": "Architecture, trade-offs at scale, mentoring and ambiguity.",
    "lead": "Strategy, cross-team decisions, risk and long-term maintainability.",
}


def build_config(category: str, entry: tuple) -> SpecializationConfig:
    name, desc, topics, tools, dims = entry
    slug = slugify(name)
    return SpecializationConfig(
        slug=slug, name=name, category=category, description=desc,
        core_competencies=list(dims), technical_topics=list(topics), tools=list(tools),
        question_categories=QUESTION_MIX_OVERRIDES.get(slug, DEFAULT_QUESTION_MIX),
        difficulty_config=DIFFICULTY_BY_LEVEL,
        evaluation_dimensions=list(dims),
        learning_topics=[f"{t} — practice problems and a small project" for t in topics],
    )


def all_specializations() -> list[SpecializationConfig]:
    return [build_config(cat, e) for cat, entries in CATALOG.items() for e in entries]


def get_specialization(slug: str) -> SpecializationConfig | None:
    return next((s for s in all_specializations() if s.slug == slug), None)
