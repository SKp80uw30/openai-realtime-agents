const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const HANDSFREE_EMAIL_CAPABILITIES = [
  {
    key: 'email.setup_priorities',
    label: 'Set up priorities',
    hint: 'Add a VIP contact or category in the setup wizard',
    order: 0,
  },
  {
    key: 'email.summarize',
    label: 'Summarise an email',
    hint: 'Say: read me a summary of my inbox',
    order: 1,
  },
  {
    key: 'email.mark_read',
    label: 'Mark an email as read',
    hint: 'Say: mark that as read',
    order: 2,
  },
  {
    key: 'email.archive',
    label: 'Archive an email',
    hint: 'Say: archive that one',
    order: 3,
  },
  {
    key: 'email.draft',
    label: 'Draft a reply',
    hint: "Say: reply and tell them I'll call back later",
    order: 4,
  },
  {
    key: 'email.send',
    label: 'Send an email',
    hint: 'Say: send that reply',
    order: 5,
  },
  {
    key: 'email.delete',
    label: 'Delete an email',
    hint: 'Say: delete that one',
    order: 6,
  },
];

async function main() {
  const group = await prisma.capabilityGroup.upsert({
    where: { key: 'handsfree-email' },
    update: { label: 'Handsfree Email' },
    create: { key: 'handsfree-email', label: 'Handsfree Email' },
  });

  for (const capability of HANDSFREE_EMAIL_CAPABILITIES) {
    await prisma.capability.upsert({
      where: { key: capability.key },
      update: {
        label: capability.label,
        hint: capability.hint,
        order: capability.order,
        groupId: group.id,
      },
      create: {
        ...capability,
        groupId: group.id,
      },
    });
  }

  console.log(`Seeded CapabilityGroup "${group.label}" with ${HANDSFREE_EMAIL_CAPABILITIES.length} capabilities.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
