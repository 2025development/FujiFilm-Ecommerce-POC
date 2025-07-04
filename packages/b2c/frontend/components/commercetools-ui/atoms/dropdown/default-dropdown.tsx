import React, { ChangeEvent, ComponentProps, FC } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import useClassNames from 'helpers/hooks/useClassNames';
import useControllableState from 'helpers/hooks/useControllable';
import { classnames } from 'helpers/utils/classnames';

export interface DropdownProps extends ComponentProps<'select'> {
  className?: string;
  containerClassName?: string;
  labelClassName?: string;
  items: Array<{ label: string; value: string }>;
  label?: string;
  value?: string;
  defaultValue?: string;
  error?: boolean;
}

const DefaultDropdown: FC<DropdownProps> = ({
  className = '',
  containerClassName = '',
  labelClassName,
  label,
  items,
  onChange,
  value,
  ...props
}) => {
  const [selectedValue, setSelectedValue] = useControllableState(value);

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedValue(value);
    onChange?.(e);
  };

  const containerClassNames = useClassNames(['grid', containerClassName]);

  const selectClassName = useClassNames([
    'absolute font-body z-[1] h-40 text-14 border-none focus:ring-0 rounded-sm w-full bg-transparent disabled:bg-neutral-200 bg-none font-regular leading-loose pl-12 pr-0 py-0',
    className,
  ]);

  const labelClassNames = useClassNames(['mb-8 text-gray-600 leading-loose font-medium text-14', labelClassName]);

  return (
    <div className={containerClassNames}>
      {label && (
        <label htmlFor={props.name} className={labelClassNames}>{`${label}${props.required ? ' *' : ''}`}</label>
      )}

      <div
        className={classnames('relative h-40 min-w-64 overflow-hidden rounded-sm border border-neutral-500', {
          'border-red-500': props.error,
        })}
      >
        <select id={props.name} className={selectClassName} value={selectedValue} onChange={handleChange} {...props}>
          {items.map(({ label, value }, index) => (
            <option key={index} value={value}>
              {label}
            </option>
          ))}
        </select>

        <ChevronDownIcon
          data-testid="chevron-down-icon"
          className="absolute right-5 top-1/2 z-0 h-20 w-30 -translate-y-1/2 stroke-1 text-gray-600"
        />
      </div>
    </div>
  );
};

export default DefaultDropdown;
