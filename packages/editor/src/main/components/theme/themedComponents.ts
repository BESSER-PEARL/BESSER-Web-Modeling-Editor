import { styled } from './styles';

/** Colours a themed shape takes instead of `fill` / `stroke`; unset falls back to the theme. */
type ThemedColorProps = { fillColor?: string; strokeColor?: string };

// Prevent custom theming props from being forwarded to the DOM
const shouldForwardThemedProp = (prop: string) => prop !== 'fillColor' && prop !== 'strokeColor';

export const ThemedPolyline = styled.polyline.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs<ThemedColorProps>(
  (props) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)<ThemedColorProps>`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedPath = styled.path.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs<ThemedColorProps>(
  (props) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)<ThemedColorProps>`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedPathContrast = styled.path.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs<ThemedColorProps>(
  (props) => ({
    stroke: props.strokeColor || 'white',
    fill: props.fillColor || 'black',
  }),
)<ThemedColorProps>`
  fill: ${(props) => props.fillColor || props.theme.color.primaryContrast};
  stroke: ${(props) => props.strokeColor || props.theme.color.background};
`;

export const ThemedRect = styled.rect.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs<ThemedColorProps>(
  (props) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)<ThemedColorProps>`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedRectContrast = styled.rect.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs<ThemedColorProps>(
  (props) => ({
    stroke: props.strokeColor || 'white',
    fill: props.fillColor || 'black',
  }),
)<ThemedColorProps>`
  fill: ${(props) => props.fillColor || props.theme.color.primaryContrast};
  stroke: ${(props) => props.strokeColor || props.theme.color.background};
`;

export const ThemedCircle = styled.circle.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs<ThemedColorProps>(
  (props) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)<ThemedColorProps>`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedCircleContrast = styled.circle.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs<ThemedColorProps>(
  (props) => ({
    stroke: props.strokeColor || 'white',
    fill: props.fillColor || 'black',
  }),
)<ThemedColorProps>`
  fill: ${(props) => props.fillColor || props.theme.color.primaryContrast};
  stroke: ${(props) => props.strokeColor || props.theme.color.background};
`;

export const ThemedEllipse = styled.ellipse.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs<ThemedColorProps>(
  (props) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)<ThemedColorProps>`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedPolygon = styled.polygon.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs<ThemedColorProps>(
  (props) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)<ThemedColorProps>`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedLine = styled.line.withConfig({
  shouldForwardProp: (prop: string) => prop !== 'strokeColor',
} as any).attrs<Pick<ThemedColorProps, 'strokeColor'>>((props) => ({
  stroke: props.strokeColor || 'black',
}))<Pick<ThemedColorProps, 'strokeColor'>>`
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;
