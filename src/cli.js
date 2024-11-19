#!/usr/bin/env node
import { program } from 'commander';
import { AlphaVantageService } from './services/AlphaVantageService.js';
import { MarketAnalyzer } from './services/MarketAnalyzer.js';
import { config } from './config/env.js';

program
    .version('1.0.0')
    .description('Market Analysis CLI');

program
    .command('analyze <symbol>')
    .description('Analyze a stock symbol')
    .action(async (symbol) => {
        try {
            const alphaVantage = new AlphaVantageService(config.alphaVantage.apiKey);
            const analyzer = new MarketAnalyzer(alphaVantage);
            
            console.log(`\nAnalyzing ${symbol}...`);
            const analysis = await analyzer.analyzeLiveMarket(symbol);
            
            // Results will be displayed by the MarketAnalyzer
        } catch (error) {
            console.error('Analysis failed:', error.message);
            process.exit(1);
        }
    });

program.parse(process.argv);