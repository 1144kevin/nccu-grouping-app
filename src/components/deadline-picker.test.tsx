import { useState } from 'react';
import { expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { DeadlinePickerModal } from './deadline-picker';

const initial = new Date(2026, 9, 29, 18, 15);
function Picker({
  onApply = jest.fn(),
  visible = true,
}: {
  onApply?: (value: Date) => void;
  visible?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DeadlinePickerModal
      startDate={initial}
      value={value}
      visible={visible}
      onChange={setValue}
      onApply={() => onApply(value)}
      onClose={() => undefined}
    />
  );
}

it('applies typed hours and minutes while keeping the selected date', async () => {
  const apply = jest.fn();
  const screen = await render(<Picker onApply={apply} />);
  await fireEvent.changeText(screen.getByLabelText('截止時間（時）'), '21');
  await fireEvent.changeText(screen.getByLabelText('截止時間（分）'), '45');
  await fireEvent.press(screen.getByRole('button', { name: '套用時間' }));
  expect(apply).toHaveBeenCalledWith(new Date(2026, 9, 29, 21, 45));
});

it('blocks empty or out-of-range input without silently changing dates', async () => {
  const apply = jest.fn();
  const screen = await render(<Picker onApply={apply} />);
  await fireEvent.changeText(screen.getByLabelText('截止時間（時）'), '24');
  expect(screen.getByRole('button', { name: '套用時間' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('截止時間（時）'), '23');
  await fireEvent.changeText(screen.getByLabelText('截止時間（分）'), '60');
  expect(screen.getByRole('button', { name: '套用時間' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('截止時間（分）'), '');
  expect(screen.getByRole('button', { name: '套用時間' })).toBeDisabled();
  expect(apply).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('截止時間（分）'), '0');
  await fireEvent.press(screen.getByRole('button', { name: '套用時間' }));
  expect(apply).toHaveBeenCalledWith(new Date(2026, 9, 29, 23, 0));
});

it('steps from the typed time and keeps minute wrapping on the same day', async () => {
  const apply = jest.fn();
  const screen = await render(<Picker onApply={apply} />);
  await fireEvent.changeText(screen.getByLabelText('截止時間（時）'), '23');
  await fireEvent.changeText(screen.getByLabelText('截止時間（分）'), '59');
  await fireEvent.press(screen.getByRole('button', { name: '增加分' }));
  expect(screen.getByLabelText('截止時間（分）').props.value).toBe('00');
  await fireEvent.press(screen.getByRole('button', { name: '套用時間' }));
  expect(apply).toHaveBeenCalledWith(new Date(2026, 9, 29, 23, 0));
});

it('pads a single digit after editing and resets unfinished input on reopen', async () => {
  const screen = await render(<Picker />);
  await fireEvent.changeText(screen.getByLabelText('截止時間（時）'), '9');
  await fireEvent(screen.getByLabelText('截止時間（時）'), 'blur');
  expect(screen.getByLabelText('截止時間（時）').props.value).toBe('09');
  await fireEvent.changeText(screen.getByLabelText('截止時間（分）'), '');
  await screen.rerender(<Picker visible={false} />);
  await screen.rerender(<Picker visible />);
  expect(screen.getByLabelText('截止時間（分）').props.value).toBe('15');
  expect(screen.getByRole('button', { name: '套用時間' })).toBeEnabled();
});
