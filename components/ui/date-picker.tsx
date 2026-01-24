'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { format, subYears } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Calendar } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DatePickerProps {
  date: Date | undefined
  onSelect: (date: Date | undefined) => void
  disabled?: boolean
  maxDate?: Date
  minDate?: Date
  placeholder?: string
}

/**
 * DatePicker component with Japanese locale support.
 * Uses react-day-picker v9 with Popover for calendar display.
 */
export function DatePicker({
  date,
  onSelect,
  disabled = false,
  maxDate = new Date(),
  minDate = subYears(new Date(), 1),
  placeholder = '日付を選択',
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (selectedDate: Date | undefined) => {
    onSelect(selectedDate)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground'
          )}
        >
          <Calendar className="mr-2 size-4" />
          {date ? format(date, 'yyyy年M月d日', { locale: ja }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker
          mode="single"
          selected={date}
          onSelect={handleSelect}
          locale={ja}
          disabled={{ before: minDate, after: maxDate }}
          defaultMonth={date ?? new Date()}
          classNames={{
            root: 'p-3',
            months: 'flex flex-col sm:flex-row gap-4',
            month: 'flex flex-col gap-4',
            month_caption: 'flex justify-center pt-1 relative items-center h-7',
            caption_label: 'text-sm font-medium',
            nav: 'flex items-center gap-1',
            button_previous: cn(
              'absolute left-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
              'inline-flex items-center justify-center rounded-md text-sm font-medium',
              'hover:bg-accent hover:text-accent-foreground'
            ),
            button_next: cn(
              'absolute right-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
              'inline-flex items-center justify-center rounded-md text-sm font-medium',
              'hover:bg-accent hover:text-accent-foreground'
            ),
            month_grid: 'w-full border-collapse',
            weekdays: 'flex',
            weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
            week: 'flex w-full mt-2',
            day: cn(
              'relative p-0 text-center text-sm',
              'focus-within:relative focus-within:z-20',
              '[&:has([aria-selected])]:bg-accent',
              '[&:has([aria-selected].day-outside)]:bg-accent/50',
              '[&:has([aria-selected].day-range-end)]:rounded-r-md'
            ),
            day_button: cn(
              'size-9 p-0 font-normal',
              'inline-flex items-center justify-center rounded-md text-sm',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'aria-selected:opacity-100'
            ),
            range_end: 'day-range-end',
            selected: cn(
              'bg-primary text-primary-foreground',
              'hover:bg-primary hover:text-primary-foreground',
              'focus:bg-primary focus:text-primary-foreground'
            ),
            today: 'bg-accent text-accent-foreground',
            outside: cn(
              'day-outside text-muted-foreground opacity-50',
              'aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30'
            ),
            disabled: 'text-muted-foreground opacity-50',
            range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
            hidden: 'invisible',
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
