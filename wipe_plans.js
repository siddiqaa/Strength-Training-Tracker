import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-blueprint.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount.serviceAccount)
});

const db = getFirestore();

async function wipe() {
  const plans = await db.collection('userPlans').get();
  const batch = db.batch();
  plans.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log("Wiped all userPlans");
}

wipe();
