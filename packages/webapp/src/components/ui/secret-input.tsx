import * as React from 'react';
import { Input } from './input';

type SecretInputProps = Omit<React.ComponentProps<typeof Input>, 'type' | 'value' | 'defaultValue' | 'ref'> & {
  value?: string;
};

/**
 * A password field for API keys and tokens. React copies a controlled input's value into its `value`
 * attribute, where injected CSS can read it (`input[value^="sk-a"] { background: url(...) }`), so this
 * one sets only the DOM property, which CSS cannot see.
 */
export const SecretInput = ({ value = '', ...props }: SecretInputProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useLayoutEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }); // On every render, as React does for a controlled input: the DOM always shows `value`.

  // eslint-disable-next-line no-restricted-syntax -- this component is the rule's answer
  return <Input ref={inputRef} type="password" {...props} />;
};
