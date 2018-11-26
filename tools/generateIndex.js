const {promisify} = require('util');
const fs = require('fs');
const path = require('path');
const _ = require('highland');
const {index, indexPath} = require('./index');

// promisified functions
const readDir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

// paths
const linksPath = path.join(__dirname, '..', 'links');

// gets all links from string
const extractLinks = str => {
  const results = [];
  const regex = /\[(.+?)\]\((.+?)\)/g;
  let res = regex.exec(str);
  while (res) {
    const url = res[2];
    results.push(url);
    res = regex.exec(str);
  }
  return results;
};

let docId = 1;

_(readDir(linksPath))
  .flatMap(arr => _(arr))
  .flatMap(filename => {
    const filePath = path.join(linksPath, filename);
    return _(readFile(filePath)).map(res => ({filename, text: res.toString()}));
  })
  .flatMap(({text, filename}) => {
    const sections = text.split('## ');
    return _(sections)
      .map(section => section.replace(/\r/g, ''))
      .filter(section => section && section.length > 0 && section.replace(/\n/g, '').length > 0)
      .map(text => ({text, filename}));
  })
  .flatMap(({text, filename}) => {
    const [, episodeName] = /\d+-\d+-(.+?)\./.exec(filename);
    const [name, linksText] = text.split(/:\n/g);
    if (!linksText) {
      console.error('Error processing file:', filename, 'section:', text);
      return _([]);
    }
    const sectionName = name.trim();
    const links = linksText.split('\n');
    return _(links)
      .filter(l => l && l.length > 0)
      .map(link => {
        const urls = extractLinks(link);
        const title = link
          .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
          .replace(/^-/g, '')
          .trim();
        return {
          id: docId++,
          category: sectionName,
          title,
          urls: urls.join(', '),
          filename,
          episodeName,
        };
      });
  })
  .filter(result => result)
  .each(result => {
    index.addDoc(result);
  })
  .done(() => {
    const indexJSON = index.toJSON();
    fs.writeFile(indexPath, JSON.stringify(indexJSON), () => {
      console.log('Successfully saved index!');
    });
  });
