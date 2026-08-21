import React, { Component, FormEvent, InputHTMLAttributes, KeyboardEvent } from 'react';
import { Size } from '../../theme/styles';
import { StyledTextfield } from './textfield-styled';

export const defaultProps = Object.freeze({
  block: true as boolean,
  gutter: false as boolean,
  multiline: false as boolean,
  outline: false as boolean,
  readonly: false as boolean,
  size: 'sm' as Size,
  enterToSubmit: true as boolean,
});

type TextfieldValue = string | number;

type Props<T extends TextfieldValue> = {
  onChange?: (value: T) => void;
  onSubmit?: (value: T) => void;
  onSubmitKeyUp?: (key: 'Escape' | 'Enter', value: T) => void;
  placeholder?: string;
  value: T;
  enterToSubmit?: boolean;
} & Omit<InputHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onSubmit' | 'value' | 'size'> &
  typeof defaultProps;

type State<T extends TextfieldValue> = {
  /** Local editing value. When defined, the user is actively typing.
   *  When undefined, the input displays props.value (from parent/Redux). */
  currentValue?: T;
};

/**
 * Controlled text input component.
 *
 * REFACTORED (2026-03-30): Changed from uncontrolled (`defaultValue`) to
 * controlled (`value`) input.
 *
 * PROBLEM: The old implementation used `defaultValue={props.value}` which only
 * sets the DOM input value on mount. When the parent switches to a different
 * element (e.g., clicking a different class in the properties panel), the new
 * `props.value` was ignored by the already-mounted input — the name field
 * kept showing the old class name.
 *
 * FIX: Use `value={state.currentValue ?? props.value}` (standard controlled
 * pattern). While the user is typing, `currentValue` holds the local draft.
 * When not editing (`currentValue` is undefined), the input reflects
 * `props.value` from the parent and updates immediately when it changes.
 * On blur/Enter, `currentValue` resets to undefined so the input falls
 * back to the parent-provided value.
 *
 * The external API (props: value, onChange, onSubmit) is unchanged — all 49
 * files that use Textfield work without modification.
 */
export class Textfield<T extends TextfieldValue> extends Component<Props<T>, State<T>> {
  static defaultProps = defaultProps;
  state: State<T> = { currentValue: undefined };
  ref = React.createRef<HTMLTextAreaElement>();

  componentDidUpdate(prevProps: Readonly<Props<T>>) {
    // If the parent changed the value externally (e.g., switched to a different
    // element), clear any stale local draft so the input shows the new value.
    if (prevProps.value !== this.props.value && this.state.currentValue !== undefined) {
      this.setState({ currentValue: undefined });
    }
  }

  componentWillUnmount() {
    if (this.state.currentValue === undefined || !this.props.onSubmit) {
      return;
    }
    this.props.onSubmit(this.state.currentValue);
  }

  render() {
    const { onChange, onSubmit, onSubmitKeyUp, size, value, ...props } = this.props;
    const displayValue = this.state.currentValue ?? value;

    return (
      <StyledTextfield
        as={props.multiline ? 'textarea' : 'input'}
        maxLength={props.multiline ? undefined : 20000}
        {...props}
        size={size}
        value={displayValue}
        onChange={this.onChange}
        onKeyUp={this.onKeyUp}
        onBlur={this.onBlur}
        ref={this.ref}
      />
    );
  }

  focus() {
    if (this.ref.current) {
      this.ref.current.focus();
    }
  }

  private onBlur = ({ currentTarget }: FormEvent<HTMLTextAreaElement>) => {
    const parsed = +currentTarget.value;
    const value: T = typeof this.props.value === 'number' ? ((Number.isNaN(parsed) ? 0 : parsed) as T) : (currentTarget.value as T);

    // Reset local draft — input will now show props.value
    this.setState({ currentValue: undefined });

    if (!value || !this.props.onSubmit) {
      return;
    }
    this.props.onSubmit(value);
  };

  private onChange = ({ currentTarget }: FormEvent<HTMLTextAreaElement>) => {
    const parsed = +currentTarget.value;
    const value: T = typeof this.props.value === 'number' ? ((Number.isNaN(parsed) ? 0 : parsed) as T) : (currentTarget.value as T);
    this.setState({ currentValue: value });

    if (!this.props.onChange) {
      return;
    }
    this.props.onChange(value);
  };

  private onKeyUp = ({ key, currentTarget }: KeyboardEvent<HTMLTextAreaElement>) => {
    const parsed = +currentTarget.value;
    const value: T = typeof this.props.value === 'number' ? ((Number.isNaN(parsed) ? 0 : parsed) as T) : (currentTarget.value as T);
    switch (key) {
      case 'Enter':
        if (this.props.enterToSubmit) {
          currentTarget.blur();
          this.onSubmitKeyUp(key, value);
        }
        break;
      case 'Escape':
        currentTarget.blur();
        this.onSubmitKeyUp(key, value);
        break;
      default:
    }
  };

  private onSubmitKeyUp = (key: 'Enter' | 'Escape', value: T) => {
    if (!this.props.onSubmitKeyUp) {
      return;
    }
    if (key === 'Enter' && !this.props.enterToSubmit) {
      return;
    }
    this.props.onSubmitKeyUp(key, value);
  };
}
