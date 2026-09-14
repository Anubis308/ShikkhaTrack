import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";

type FieldChrome = {
  className?: string;
  error?: string;
  label: string;
  required?: boolean;
  style?: CSSProperties;
};

function FieldWrap({
  children,
  className,
  controlId,
  error,
  label,
  required,
  style
}: FieldChrome & { children: ReactNode; controlId: string }) {
  return (
    <label className={cn("form-field", error && "form-field-invalid", className)} htmlFor={controlId} style={style}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      {error ? (
        <p className="field-error" id={`${controlId}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}

function describedBy(controlId: string, error?: string) {
  return error ? `${controlId}-error` : undefined;
}

export const FormField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldChrome>(
  function FormField({ className, error, id, label, required, style, ...props }, ref) {
    const generatedId = useId();
    const controlId = id || generatedId;
    return (
      <FieldWrap className={className} controlId={controlId} error={error} label={label} required={required} style={style}>
        <input
          {...props}
          aria-describedby={describedBy(controlId, error)}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          id={controlId}
          ref={ref}
        />
      </FieldWrap>
    );
  }
);

export const PasswordField = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & FieldChrome>(
  function PasswordField({ className, error, id, label, required, style, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const controlId = id || generatedId;
    return (
      <FieldWrap className={className} controlId={controlId} error={error} label={label} required={required} style={style}>
        <div className="password-field">
          <input
            {...props}
            aria-describedby={describedBy(controlId, error)}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            id={controlId}
            ref={ref}
            type={visible ? "text" : "password"}
          />
          <button
            aria-label={visible ? "Hide password" : "Show password"}
            className="icon-button"
            onClick={() => setVisible((value) => !value)}
            type="button"
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </FieldWrap>
    );
  }
);

export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldChrome>(
  function SelectField({ children, className, error, id, label, required, style, ...props }, ref) {
    const generatedId = useId();
    const controlId = id || generatedId;
    return (
      <FieldWrap className={className} controlId={controlId} error={error} label={label} required={required} style={style}>
        <select
          {...props}
          aria-describedby={describedBy(controlId, error)}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          id={controlId}
          ref={ref}
        >
          {children}
        </select>
      </FieldWrap>
    );
  }
);

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldChrome>(
  function TextAreaField({ className, error, id, label, required, style, ...props }, ref) {
    const generatedId = useId();
    const controlId = id || generatedId;
    return (
      <FieldWrap className={className} controlId={controlId} error={error} label={label} required={required} style={style}>
        <textarea
          {...props}
          aria-describedby={describedBy(controlId, error)}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          id={controlId}
          ref={ref}
        />
      </FieldWrap>
    );
  }
);
