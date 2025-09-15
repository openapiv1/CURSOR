import { PromptBox } from "@/components/ui/chatgpt-prompt-input";

interface InputProps {
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isInitializing: boolean;
  isLoading: boolean;
  status: string;
  stop: () => void;
}

export const Input = ({
  input,
  handleInputChange,
  isInitializing,
  isLoading,
  status,
  stop,
}: InputProps) => {
  return (
    <PromptBox 
      input={input}
      handleInputChange={handleInputChange}
      isInitializing={isInitializing}
      isLoading={isLoading}
      status={status}
      stop={stop}
    />
  )
}