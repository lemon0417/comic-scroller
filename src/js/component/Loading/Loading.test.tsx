import { render } from '@testing-library/react';
import Loading from './index';

test('Loading contains circle svg', () => {
  const { container } = render(<Loading />);
  const circle = container.querySelector('svg circle');
  expect(circle).toBeInTheDocument();
  expect(circle).toHaveAttribute('cx', '30');
  expect(circle).toHaveAttribute('cy', '30');
  expect(circle).toHaveAttribute('r', '25');
});

test('Loading snapshot', () => {
  const { asFragment } = render(<Loading />);
  expect(asFragment()).toMatchSnapshot();
});
