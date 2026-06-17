const { withAppBuildGradle } = require('expo/config-plugins');

function addSplitsToBuildGradle(buildGradle) {
  // Add the splits block after android block
  const splitsConfig = `
android {
    splits {
        abi {
            enable true
            reset()
            include 'arm64-v8a', 'armeabi-v7a', 'x86_64'
            universalApk false
        }
    }
}

`;
  // Insert splits block before the final closing of android block
  // We need to find the closing of the defaultConfig or the android block
  if (buildGradle.includes('splits')) {
    return buildGradle; // already configured
  }

  // Insert after the last defaultConfig or buildTypes block
  const insertPoint = buildGradle.lastIndexOf('}');
  if (insertPoint > 0) {
    return buildGradle.slice(0, insertPoint) + splitsConfig + buildGradle.slice(insertPoint);
  }
  return buildGradle;
}

module.exports = function withAndroidSplits(config) {
  return withAppBuildGradle(config, (config) => {
    config.modResults.contents = addSplitsToBuildGradle(
      config.modResults.contents
    );
    return config;
  });
};
