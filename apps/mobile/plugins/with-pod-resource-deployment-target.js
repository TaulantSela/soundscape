const { withPodfile } = require('expo/config-plugins');

const MARKER = '# soundscape: raise pod resource bundle deployment targets';

/**
 * Xcode 27 refuses iOS deployment targets below 15.0. React Native raises
 * every pod target to the app's minimum, but not the resource bundles some
 * pods declare (AsyncStorage's privacy manifest is one), so those keep the
 * podspec's old minimum and fail the build. Raise them to the app's minimum.
 */
const POST_INSTALL_SNIPPET = `
    ${MARKER}
    minimum_ios = podfile_properties['ios.deploymentTarget'] || '15.1'
    installer.target_installation_results.pod_target_installation_results.each_value do |result|
      result.resource_bundle_targets.each do |bundle_target|
        bundle_target.build_configurations.each do |build_config|
          current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
          if current && Gem::Version.new(current) < Gem::Version.new(minimum_ios)
            build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios
          end
        end
      end
    end`;

module.exports = function withPodResourceDeploymentTarget(config) {
  return withPodfile(config, (podConfig) => {
    const podfile = podConfig.modResults;
    if (podfile.contents.includes(MARKER)) {
      return podConfig;
    }
    const hook = 'post_install do |installer|';
    if (!podfile.contents.includes(hook)) {
      throw new Error('with-pod-resource-deployment-target: no post_install hook in the Podfile');
    }
    podfile.contents = podfile.contents.replace(hook, `${hook}${POST_INSTALL_SNIPPET}`);
    return podConfig;
  });
};
