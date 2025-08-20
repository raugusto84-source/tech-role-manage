import { SimpleDiagnosticFlow } from './SimpleDiagnosticFlow';

interface DiagnosticChecklistProps {
  onDiagnosisComplete?: (result: {
    flow_id: string;
    problem_title: string;
    answers: { [key: string]: string };
    recommended_solution: any;
    recommended_services: any[];
  }) => void;
}

export function DiagnosticChecklist({ onDiagnosisComplete }: DiagnosticChecklistProps) {
  return (
    <SimpleDiagnosticFlow onDiagnosisComplete={onDiagnosisComplete} />
  );
}