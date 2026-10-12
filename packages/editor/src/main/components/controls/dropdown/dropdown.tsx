import React, { Children, Component, createRef, ReactElement } from 'react';
import { Color, Size } from '../../theme/styles';
import { DropdownButton } from './dropdown-button';
import { DropdownItem, Props as ItemProps } from './dropdown-item';
import { DropdownMenu } from './dropdown-menu';
import { DropdownItemProps, DropdownSizer, StyledDropdown, StyledDropdownItem } from './dropdown-styles';

const defaultProps = Object.freeze({
  color: 'primary' as Color,
  // Reserve the width of the widest option instead of resizing with the selected
  // value. Use it for short, fixed option lists that sit next to a label.
  fitWidestOption: false as boolean,
  outline: true as boolean,
  placeholder: '' as string,
  size: 'sm' as Size,
});

const initialState = Object.freeze({
  show: false as boolean,
  top: 0 as number,
  left: 0 as number,
  width: 0 as number,
});

export type Props<T> = {
  children: ReactElement<ItemProps<T>> | ReactElement<ItemProps<T>>[];
  onChange?: (value: T) => void;
  value: T;
} & typeof defaultProps;

type State = typeof initialState;

export class Dropdown<T> extends Component<Props<T>, State> {
  static defaultProps = defaultProps;
  static Item = DropdownItem;
  state = initialState;
  activator = createRef<HTMLButtonElement>();
  menu = createRef<HTMLDivElement>();

  componentDidUpdate(_: Props<T>, prevState: State) {
    // Move focus into the list when it opens, onto the current value if there is one.
    if (!prevState.show && this.state.show && this.menu.current) {
      const options = this.getOptions();
      const current = options.find((option) => option.getAttribute('aria-selected') === 'true') ?? options[0];
      if (current) this.focusOption(current);
    }
  }

  componentWillUnmount() {
    if (this.activator.current) {
      const parent = this.getScrollableParent(this.activator.current);
      parent.removeEventListener('scroll', this.dismiss);
    }
    document.removeEventListener('click', this.dismiss);
  }

  render() {
    const { color, fitWidestOption, outline, placeholder, size } = this.props;
    const { show, top, left, width } = this.state;
    const items = Children.toArray(this.props.children) as ReactElement<ItemProps<T>>[];
    const selected: ReactElement<ItemProps<T>> | undefined = items.find(
      (item: ReactElement<ItemProps<T>>) => item.props.value === this.props.value,
    );

    return (
      <StyledDropdown $fitWidestOption={fitWidestOption}>
        <DropdownButton
          ref={this.activator}
          color={color}
          onClick={(event) => this.show(event)}
          onKeyDown={this.onActivatorKeyDown}
          outline={outline}
          size={size}
          aria-haspopup="listbox"
          aria-expanded={show}
        >
          {selected ? selected.props.children : placeholder}
        </DropdownButton>
        {/* After the button: a grid takes its baseline from its first item, and
            rows that align on the label's baseline must line up with the button. */}
        {fitWidestOption && (
          <DropdownSizer aria-hidden="true">
            {[placeholder, ...items.map((item) => item.props.children)].map((label, index) => (
              <DropdownButton key={index} type="button" tabIndex={-1} color={color} outline={outline} size={size}>
                {label}
              </DropdownButton>
            ))}
          </DropdownSizer>
        )}
        {show && (
          <DropdownMenu
            ref={this.menu}
            role="listbox"
            style={{ top, left, minWidth: width }}
            onKeyDown={this.onMenuKeyDown}
          >
            {Children.map<ReactElement<DropdownItemProps>, ReactElement<ItemProps<T>>>(
              this.props.children,
              ({ props }) => this.renderItem(props),
            )}
          </DropdownMenu>
        )}
      </StyledDropdown>
    );
  }

  renderItem(item: ItemProps<T>): ReactElement<DropdownItemProps> {
    const { size } = this.props;

    return (
      <StyledDropdownItem
        size={size}
        onClick={this.select(item.value)}
        role="option"
        aria-selected={item.value === this.props.value}
        tabIndex={-1}
      >
        {item.children}
      </StyledDropdownItem>
    );
  }

  private dismiss = () => {
    if (this.activator.current) {
      const parent = this.getScrollableParent(this.activator.current);
      parent.removeEventListener('scroll', this.dismiss);
    }
    document.removeEventListener('click', this.dismiss);

    this.setState({ show: false });
  };

  private select = (value: T) => () => {
    if (!this.props.onChange) {
      return;
    }

    this.props.onChange(value);
    this.activator.current?.focus({ preventScroll: true });
  };

  private getOptions = (): HTMLElement[] =>
    this.menu.current ? Array.from(this.menu.current.querySelectorAll<HTMLElement>('[role="option"]')) : [];

  /** Focus an option, scrolling only the menu itself: scrolling the page would dismiss it. */
  private focusOption = (option: HTMLElement | undefined) => {
    const menu = this.menu.current;
    if (!option || !menu) return;
    option.focus({ preventScroll: true });
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < menu.scrollTop) {
      menu.scrollTop = top;
    } else if (bottom > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = bottom - menu.clientHeight;
    }
  };

  private onActivatorKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !this.state.show) {
      event.preventDefault();
      // Arrow keys would otherwise also move the selected canvas elements.
      event.stopPropagation();
      this.activator.current?.click();
    }
  };

  private onMenuKeyDown = (event: React.KeyboardEvent) => {
    const options = this.getOptions();
    const index = options.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        this.focusOption(options[Math.min(index + 1, options.length - 1)]);
        break;
      case 'ArrowUp':
        this.focusOption(options[Math.max(index - 1, 0)]);
        break;
      case 'Home':
        this.focusOption(options[0]);
        break;
      case 'End':
        this.focusOption(options[options.length - 1]);
        break;
      case 'Escape':
        this.dismiss();
        this.activator.current?.focus({ preventScroll: true });
        break;
      case 'Tab':
        this.dismiss();
        return;
      default:
        // Enter and Space activate the focused option natively (it is a button).
        return;
    }
    event.preventDefault();
    // Escape would otherwise also close the properties panel, arrows would move canvas elements.
    event.stopPropagation();
  };

  private show = (event: React.MouseEvent) => {
    if (!this.activator.current) {
      return;
    }

    // Close any other open dropdown before opening this one
    if (!this.state.show) {
      document.dispatchEvent(new MouseEvent('click'));
    }

    const parent = this.getScrollableParent(this.activator.current);
    const activatorBounds = this.activator.current.getBoundingClientRect();

    this.setState({
      show: true,
      top: activatorBounds.bottom,
      left: activatorBounds.left,
      width: activatorBounds.width,
    });

    parent.addEventListener('scroll', this.dismiss);
    document.addEventListener('click', this.dismiss);
    event.stopPropagation();
  };

  private getScrollableParent = (element: Element): Element => {
    const style = getComputedStyle(element);

    const isScrollable = /(auto|scroll)/.test([style.overflow, style.overflowY, style.overflowX].join(''));
    if (isScrollable) {
      return element;
    }

    const parent = element.parentElement;
    if (parent) {
      return this.getScrollableParent(parent);
    }

    return document.body;
  };
}
