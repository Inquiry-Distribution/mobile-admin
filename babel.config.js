module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@navigation':  './src/navigation',
          '@components':  './src/components',
          '@screens':     './src/screens',
          '@constants':   './src/constants',
          '@hooks':       './src/hooks',
          '@services':    './src/services',
          '@store':       './src/store',
          '@utils':       './src/utils',
          '@api':         './src/api',
          '@assets':      './src/assets',
        },
      },
    ],
  ],
};
