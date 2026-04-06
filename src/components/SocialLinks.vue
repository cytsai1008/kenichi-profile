<script setup lang="ts">
import { Icon } from "@iconify/vue";

interface SocialLink {
  label: string;
  href: string;
  icon: string;
  iconWidth?: number;
  iconHeight?: number;
  iconClass?: string;
}

defineProps<{
  links: SocialLink[];
}>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-4">
    <a
      v-for="link in links"
      :key="link.href"
      :href="link.href"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex h-11 w-11 items-center justify-center rounded-full text-fg! no-underline transition-colors hover:bg-surface-alt hover:text-fg/70!"
      :aria-label="link.label"
      :title="link.label"
    >
      <span class="sr-only">{{ link.label }}</span>
      <Icon
        :icon="link.icon"
        :width="link.iconWidth ?? 20"
        :height="link.iconHeight ?? 20"
        :class="['text-current', link.iconClass]"
        aria-hidden="true"
      />
    </a>
  </div>
</template>
