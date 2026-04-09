graph TD
    Start([Start]) --> A[View available courses]
    A --> B[Display available courses]
    B --> C[Select a course]
    C --> D[Show course details and available sections]
    D --> Decision{Check available seats}
    Decision -->|Yes| E[Enroll student]
    E --> F[Show success message]
    F --> End([End])
    Decision -->|No| G[Show error message]
    G --> A
