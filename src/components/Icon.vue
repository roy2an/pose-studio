<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 16 },
})

const ICONS = {
  undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  redo: ['M15 14l5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
  mirror: ['M12 2v20', 'M9 6 4 12l5 6V6z', 'M15 6l5 6-5 6V6z'],
  reset: ['M3.5 12a8.5 8.5 0 1 0 3-6.5', 'M3 3.5V9h5.5'],
  camera: [
    'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h6l2 3h3a2 2 0 0 1 2 2z',
    'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  help: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'M9.6 9.2a2.5 2.5 0 1 1 3.7 2.3c-.8.5-1.3 1-1.3 2',
    'M12 17.4v.1',
  ],
  'arr-down': ['m4 9l8 8l8-8'],
  'arr-right': ['m8 4l8 8l-8 8'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  check: ['M20 6.5 9.6 17 4 11.4'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  code: ['M9 6l-5 6 5 6', 'M15 6l5 6-5 6', 'M13.5 4.5l-3 15'],
  chevron: ['M9 6l6 6-6 6'],
  bones: ['M8 8.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M16 9.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M10.8 11.6h2.4'],
  grid: ['M3.5 3.5h17v17h-17z', 'M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17'],
  search: ['M11 19.2a8.2 8.2 0 1 0 0-16.4 8.2 8.2 0 0 0 0 16.4z', 'M21 21l-4.4-4.4'],
  target: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  expand: ['M7 9.5 12 4l5 5.5', 'M17 14.5 12 20l-5-5.5'],
  collapse: ['M7 4.5 12 10l5-5.5', 'M17 19.5 12 14l-5 5.5'],
  spine: ['M12 3v18', 'M8 6h8M8 11h8M8 16h8'],
}

const paths = computed(() => ICONS[props.name] || [])
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>
