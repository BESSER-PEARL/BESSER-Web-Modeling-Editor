import animals from './animals.json';
import adjectives from './adjectives.json';

export const generateRandomName = () => {
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];

  return `${titleCaseWord(adjective)} ${animal}`;
};

const titleCaseWord = (word: string) => {
  if (!word) return word;
  return word[0].toUpperCase() + word.substr(1).toLowerCase();
};
