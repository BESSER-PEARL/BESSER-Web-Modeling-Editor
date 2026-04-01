import { styled } from './styles';

// Prevent custom theming props from being forwarded to the DOM
const shouldForwardThemedProp = (prop: string) => prop !== 'fillColor' && prop !== 'strokeColor';

export const ThemedPolyline = styled.polyline.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs(
  (props: { fillColor: string | undefined; strokeColor: string | undefined }) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedPath = styled.path.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs(
  (props: { fillColor: string | undefined; strokeColor: string | undefined }) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedPathContrast = styled.path.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs(
  (props: { fillColor: string | undefined; strokeColor: string | undefined }) => ({
    stroke: props.strokeColor || 'white',
    fill: props.fillColor || 'black',
  }),
)`
  fill: ${(props) => props.fillColor || props.theme.color.primaryContrast};
  stroke: ${(props) => props.strokeColor || props.theme.color.background};
`;

export const ThemedRect = styled.rect.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs(
  (props: { fillColor: string | undefined; strokeColor: string | undefined }) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedRectContrast = styled.rect.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs(
  (props: { fillColor: string | undefined; strokeColor: string | undefined }) => ({
    stroke: props.strokeColor || 'white',
    fill: props.fillColor || 'black',
  }),
)`
  fill: ${(props) => props.fillColor || props.theme.color.primaryContrast};
  stroke: ${(props) => props.strokeColor || props.theme.color.background};
`;

export const ThemedCircle = styled.circle.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs(
  (props: { fillColor: string | undefined; strokeColor: string | undefined }) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedCircleContrast = styled.circle.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs(
  (props: { fillColor: string | undefined; strokeColor: string | undefined }) => ({
    stroke: props.strokeColor || 'white',
    fill: props.fillColor || 'black',
  }),
)`
  fill: ${(props) => props.fillColor || props.theme.color.primaryContrast};
  stroke: ${(props) => props.strokeColor || props.theme.color.background};
`;

export const ThemedEllipse = styled.ellipse.withConfig({
  shouldForwardProp: shouldForwardThemedProp as any,
}).attrs(
  (props: { fillColor: string | undefined; strokeColor: string | undefined }) => ({
    stroke: props.strokeColor || 'black',
    fill: props.fillColor || 'white',
  }),
)`
  fill: ${(props) => props.fillColor || props.theme.color.background};
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;

export const ThemedLine = styled.line.withConfig({
  shouldForwardProp: (prop: string) => prop !== 'strokeColor',
} as any).attrs((props: { strokeColor: string | undefined }) => ({
  stroke: props.strokeColor || 'black',
}))`
  stroke: ${(props) => props.strokeColor || props.theme.color.primaryContrast};
`;
