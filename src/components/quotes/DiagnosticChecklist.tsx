import { ClientDiagnosticFlow } from './ClientDiagnosticFlow';

interface DiagnosticChecklistProps {
  problemId?: string;
  onComplete?: (answers: Record<string, boolean>) => void;
  onDiagnosisComplete?: (result: {
    flow_id: string;
    problem_title: string;
    answers: { [key: string]: string };
    recommended_solution: any;
  }) => void;
}

export function DiagnosticChecklist({ onDiagnosisComplete }: DiagnosticChecklistProps) {
  return (
    <ClientDiagnosticFlow onDiagnosisComplete={onDiagnosisComplete} />
  );
}