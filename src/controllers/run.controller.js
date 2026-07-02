export const executeServerScript = async (req, res) => {
  const { code } = req.body;
  const isC = code.includes("#include") || code.includes("printf(");

  let output =
    "This is C/Java code. Press Enter+Enter to save it, then run it locally.";
  res.json({ output });
};
