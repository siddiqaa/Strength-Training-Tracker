import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
  const plansSnap = await getDocs(collection(db, 'userPlans'));
  const plans = [];
  for (const doc of plansSnap.docs) {
    plans.push({ id: doc.id, data: doc.data() });
    await deleteDoc(doc.ref);
  }
  
  const workoutsSnap = await getDocs(collection(db, 'workouts'));
  let deletedWorkouts = 0;
  for (const doc of workoutsSnap.docs) {
    await deleteDoc(doc.ref);
    deletedWorkouts++;
  }
  
  console.log('PLANS:', JSON.stringify(plans, null, 2));
  console.log('Deleted Workouts:', deletedWorkouts);
  process.exit(0);
}
main().catch(console.error);
