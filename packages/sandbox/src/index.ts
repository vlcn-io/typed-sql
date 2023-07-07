const schema = {
  sql(strings: TemplateStringsArray, ...values: any[]) {
    let str = '';
    strings.forEach((string, i) => {
      str += string + (values[i] || '');
    });
    return str;
  },
};

schema.sql<ZOMG>`Hey!`;

// const x = "sdf";
