import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Core_ConfigService } from '../services/core/core-config-service.js';

test('normalizeBaseUrl() handles root deployments', () => {
    assert.equal(Core_ConfigService.normalizeBaseUrl(null), '/');
    assert.equal(Core_ConfigService.normalizeBaseUrl(undefined), '/');
    assert.equal(Core_ConfigService.normalizeBaseUrl(''), '/');
    assert.equal(Core_ConfigService.normalizeBaseUrl('/'), '/');
    assert.equal(Core_ConfigService.normalizeBaseUrl('   /   '), '/');
});

test('normalizeBaseUrl() handles subpath deployments', () => {
    assert.equal(Core_ConfigService.normalizeBaseUrl('MyJourney'), '/MyJourney');
    assert.equal(Core_ConfigService.normalizeBaseUrl('/MyJourney/'), '/MyJourney');
    assert.equal(Core_ConfigService.normalizeBaseUrl('/MyJourney///'), '/MyJourney');
});

test('setBaseUrl/getBaseUrl persist normalized values', () => {
    const config = new Core_ConfigService();
    config.setBaseUrl('/MyJourney/');
    assert.equal(config.getBaseUrl(), '/MyJourney');
});

test('getRelativePath strips a subpath base prefix', () => {
    const config = new Core_ConfigService();
    config.setBaseUrl('/MyJourney');

    assert.equal(config.getRelativePath('/MyJourney/journeys/1'), '/journeys/1');
    assert.equal(config.getRelativePath('/MyJourney'), '/');
});

test('getRelativePath leaves paths unchanged at document root', () => {
    const config = new Core_ConfigService();
    config.setBaseUrl('/');

    assert.equal(config.getRelativePath('/journeys/1'), '/journeys/1');
});

test('getRoute returns relative route without base prefix', () => {
    const config = new Core_ConfigService();
    config.setBaseUrl('/MyJourney');
    config.setRoute('home', '/MyJourney/home');

    assert.equal(config.getRoute('home'), '/home');
    assert.equal(config.getFullRoute('home'), '/MyJourney/home');
});
