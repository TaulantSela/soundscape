// Hermes provides btoa and atob at runtime, but React Native's types don't declare them. Under
// TypeScript 5 they came along with @types/node; TypeScript 6 no longer loads every @types package.
declare function btoa(data: string): string;
declare function atob(data: string): string;
