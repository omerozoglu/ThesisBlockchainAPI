const isVaildSHA256 = (hash) => {
  const regex = /^[a-f0-9]{64}$/;
  return regex.test(hash);
};

module.exports = isVaildSHA256;
